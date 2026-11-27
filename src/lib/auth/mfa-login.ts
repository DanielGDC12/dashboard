import "server-only";
import { createClient as createSupabaseClient, type EmailOtpType } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Login só com o código do app autenticador (TOTP), para quem já concluiu o
 * primeiro acesso (e-mail + cadastro do autenticador).
 *
 * O Supabase só aceita verificar TOTP dentro de uma sessão. Por isso o servidor:
 *   1. gera um link de login para o e-mail (admin, nada é enviado);
 *   2. troca esse link por uma sessão aal1 num cliente efêmero, só em memória;
 *   3. valida o código TOTP nessa sessão → sessão aal2;
 *   4. só então grava a sessão nos cookies do navegador.
 * Se o código estiver errado, a sessão aal1 é revogada e nunca chega ao navegador.
 */

export type LoginStatus = { userId: string | null; totpFactorId: string | null };

/** Usuário de Auth e fator TOTP verificado de um e-mail (service role). */
export async function getLoginStatus(email: string): Promise<LoginStatus> {
  const { data, error } = await createAdminClient()
    .rpc("auth_login_status", { p_email: email })
    .maybeSingle<{ user_id: string; totp_factor_id: string | null }>();
  if (error) throw new Error(`auth_login_status falhou: ${error.message}`);
  return { userId: data?.user_id ?? null, totpFactorId: data?.totp_factor_id ?? null };
}

// ---------------------------------------------------------------------------
// Bloqueio por tentativas (com login só por TOTP, é a principal defesa contra
// força bruta). Usa a própria trilha de auditoria como contador.
// ---------------------------------------------------------------------------
const LOCKOUT_RULES = [
  { windowMinutes: 15, maxFailures: 5 },
  { windowMinutes: 24 * 60, maxFailures: 20 },
] as const;

export async function isLockedOut(email: string): Promise<boolean> {
  const admin = createAdminClient();
  for (const rule of LOCKOUT_RULES) {
    const since = new Date(Date.now() - rule.windowMinutes * 60_000).toISOString();
    const { count, error } = await admin
      .from("auth_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("event", "mfa_failed")
      .eq("email", email)
      .gte("created_at", since);
    // Fail closed: sem conseguir contar, não deixamos tentar.
    if (error) {
      console.error("[auth] lockout count failed", error.message);
      return true;
    }
    if ((count ?? 0) >= rule.maxFailures) return true;
  }
  return false;
}

export type TotpLoginResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "bad_code" | "error"; status?: number };

export async function signInWithTotp(input: {
  email: string;
  factorId: string;
  code: string;
}): Promise<TotpLoginResult> {
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    console.error("[auth] generateLink failed", linkError && { status: linkError.status, code: linkError.code });
    return { ok: false, reason: "error", status: linkError?.status };
  }

  const { supabaseUrl, supabasePublishableKey } = requirePublicEnv();
  const ephemeral = createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: otpError } = await ephemeral.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: link.properties.verification_type as EmailOtpType,
  });
  if (otpError) {
    console.error("[auth] verifyOtp(token_hash) failed", { status: otpError.status, code: otpError.code });
    return { ok: false, reason: "error", status: otpError.status };
  }

  const { data: verified, error: mfaError } = await ephemeral.auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code,
  });
  if (mfaError || !verified) {
    // Revoga só esta sessão aal1 (scope local) — não derruba outros logins do usuário.
    await ephemeral.auth.signOut({ scope: "local" });
    const status = mfaError?.status;
    return { ok: false, reason: status === 429 || (status ?? 0) >= 500 ? "error" : "bad_code", status };
  }

  return { ok: true, accessToken: verified.access_token, refreshToken: verified.refresh_token };
}
