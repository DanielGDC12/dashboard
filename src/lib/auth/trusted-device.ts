import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AUTH } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestInfo } from "./request-info";

/**
 * "Lembrar meu e-mail neste computador".
 * Desde o login só por MFA, o dispositivo lembrado NÃO pula nenhum fator: ele só
 * preenche o e-mail e leva direto ao código do app autenticador.
 * (Tabela e cookie mantêm o nome antigo, trusted_devices / mtq_trusted_device.)
 */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function findDevice() {
  const token = (await cookies()).get(AUTH.trustedDeviceCookie)?.value;
  if (!token) return null;
  const { data } = await createAdminClient()
    .from("trusted_devices")
    .select("id, user_id")
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

/** E-mail lembrado neste navegador (ou null). Somente leitura: seguro em Server Components. */
export async function getRememberedEmail(): Promise<string | null> {
  const device = await findDevice();
  if (!device) return null;
  const { data, error } = await createAdminClient().auth.admin.getUserById(device.user_id);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

/** Atualiza last_used_at. Só em Server Actions / Route Handlers. */
export async function touchRememberedDevice(userId: string) {
  const token = (await cookies()).get(AUTH.trustedDeviceCookie)?.value;
  if (!token) return;
  await createAdminClient()
    .from("trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .eq("user_id", userId);
}

/**
 * Lembra este computador para `userId` e grava o cookie httpOnly.
 * Chamar só logo depois de uma verificação TOTP bem-sucedida.
 */
export async function rememberThisDevice(userId: string) {
  const existing = await findDevice();
  if (existing?.user_id === userId) {
    await touchRememberedDevice(userId);
    return "touched" as const;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTH.trustedDeviceDays * 86_400_000);
  const { ip, userAgent } = await getRequestInfo();

  const { error } = await createAdminClient().from("trusted_devices").insert({
    user_id: userId,
    token_hash: hash(token),
    user_agent: userAgent,
    ip,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`trusted device insert failed: ${error.message}`);

  (await cookies()).set(AUTH.trustedDeviceCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return "created" as const;
}

/** "Trocar" de conta: esquece o e-mail lembrado neste navegador. */
export async function forgetThisDevice() {
  const store = await cookies();
  const token = store.get(AUTH.trustedDeviceCookie)?.value;
  if (!token) return;
  await createAdminClient()
    .from("trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .is("revoked_at", null);
  store.delete(AUTH.trustedDeviceCookie);
}
