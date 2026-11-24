import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY on the server for:
 * whitelist lookups, trusted devices and the audit log.
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY não definido (.env.local).");
  }
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
