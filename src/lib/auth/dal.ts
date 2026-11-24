import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findAllowedUser, type AllowedUser } from "./whitelist";
import { isTrustedDevice } from "./trusted-device";

export type SessionState =
  | { status: "anonymous" }
  | { status: "not_allowed"; email: string }
  | { status: "needs_mfa"; userId: string; email: string }
  | { status: "authenticated"; user: AllowedUser & { authId: string; viaTrustedDevice: boolean } };

/**
 * Single source of truth for "who is this request?".
 * Session must exist (verified JWT) + e-mail in whitelist + (aal2 OR trusted device).
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // Per-request by nature (session expiry checks use Date.now()): never prerender.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { status: "anonymous" };

  const email = typeof claims.email === "string" ? claims.email : "";
  const allowed = email ? await findAllowedUser(email) : null;
  if (!allowed) return { status: "not_allowed", email };

  if (claims.aal === "aal2") {
    return { status: "authenticated", user: { ...allowed, authId: claims.sub, viaTrustedDevice: false } };
  }
  if (await isTrustedDevice(claims.sub)) {
    return { status: "authenticated", user: { ...allowed, authId: claims.sub, viaTrustedDevice: true } };
  }
  return { status: "needs_mfa", userId: claims.sub, email };
});

/** Use in every protected page, layout section and Server Action. */
export async function requireUser() {
  const state = await getSessionState();
  if (state.status !== "authenticated") redirect("/login");
  return state.user;
}
