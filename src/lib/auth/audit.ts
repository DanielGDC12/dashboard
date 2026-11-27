import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestInfo } from "./request-info";

export type AuthAuditEvent =
  | "login_denied_not_allowed"
  | "email_code_sent"
  | "email_code_failed"
  | "email_code_verified"
  | "mfa_enrolled"
  | "mfa_verified"
  | "mfa_failed"
  | "mfa_login_locked"
  | "trusted_device_created"
  | "trusted_device_used"
  | "logout";

/** Append-only. Never throws: an audit failure must not block login. */
export async function audit(
  event: AuthAuditEvent,
  data: { email?: string | null; userId?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    const { ip, userAgent } = await getRequestInfo();
    const admin = createAdminClient();
    const { error } = await admin.from("auth_audit_log").insert({
      event,
      email: data.email ?? null,
      user_id: data.userId ?? null,
      ip,
      user_agent: userAgent,
      metadata: data.metadata ?? {},
    });
    if (error) console.error("[audit] insert failed", error.message);
  } catch (err) {
    console.error("[audit] unexpected", err);
  }
}
