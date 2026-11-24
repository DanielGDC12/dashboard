import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AUTH } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestInfo } from "./request-info";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * True when this browser holds a valid, non-expired trusted-device token that
 * belongs to `userId`. Read-only (safe in Server Components).
 */
export async function isTrustedDevice(userId: string): Promise<boolean> {
  const token = (await cookies()).get(AUTH.trustedDeviceCookie)?.value;
  if (!token) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("trusted_devices")
    .select("id")
    .eq("token_hash", hash(token))
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return Boolean(data);
}

/** Updates last_used_at. Call only from Server Actions / Route Handlers. */
export async function touchTrustedDevice(userId: string) {
  const token = (await cookies()).get(AUTH.trustedDeviceCookie)?.value;
  if (!token) return;
  await createAdminClient()
    .from("trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .eq("user_id", userId);
}

/**
 * Creates a trusted device for `userId` and sets the httpOnly cookie.
 * Must only be called right after a successful TOTP verification.
 */
export async function trustThisDevice(userId: string) {
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
}
