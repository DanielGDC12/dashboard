import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole = "gestao" | "logistica" | "atendimento";

export type AllowedUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Returns the whitelist entry when the e-mail is allowed and active, else null. */
export async function findAllowedUser(email: string): Promise<AllowedUser | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("allowed_users")
    .select("id, email, full_name, role")
    .eq("email", normalizeEmail(email))
    .eq("active", true)
    .maybeSingle();

  if (error) {
    // Fail closed: a lookup error never grants access.
    console.error("[whitelist] lookup failed", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as UserRole,
  };
}
