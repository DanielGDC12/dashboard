/**
 * Centralised env access. Public values are inlined at build time by Next.js,
 * so they must be read with the literal `process.env.NEXT_PUBLIC_*` expression.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  /** "producao" | "hlg" — drives the environment badge on screen. */
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV ?? "producao") as "producao" | "hlg",
};

export function requirePublicEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).",
    );
  }
  return publicEnv;
}

export const AUTH = {
  /** Length of the e-mail OTP. Must match Auth › Email OTP length in Supabase. */
  emailOtpLength: 6,
  totpLength: 6,
  trustedDeviceDays: 30,
  trustedDeviceCookie: "mtq_trusted_device",
} as const;
