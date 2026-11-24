"use server";

import { z } from "zod";
import { isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { findAllowedUser, normalizeEmail, type AllowedUser } from "@/lib/auth/whitelist";
import { isTrustedDevice, touchTrustedDevice, trustThisDevice } from "@/lib/auth/trusted-device";
import { audit } from "@/lib/auth/audit";
import { getSessionState } from "@/lib/auth/dal";

// ---------------------------------------------------------------------------
// Types shared with the client
// ---------------------------------------------------------------------------
export type SecondFactor =
  | { next: "done" }
  | { next: "verify"; factorId: string }
  | { next: "enroll"; factorId: string; qrCode: string; secret: string };

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;

const MSG = {
  invalidEmail: "Digite um e-mail válido.",
  notAllowed:
    "Este e-mail não tem acesso ao Painel de Entregas. Peça um convite a um administrador.",
  rateLimited: "Muitas tentativas. Aguarde um minuto e tente de novo.",
  badEmailCode: "Código inválido ou expirado. Confira o e-mail ou peça um novo código.",
  badTotp: "Código incorreto. Confira se o horário do celular está automático e tente de novo.",
  sessionLost: "Sua sessão expirou. Comece de novo pelo e-mail.",
  generic: "Não foi possível concluir agora. Tente de novo em instantes.",
  config:
    "Não foi possível verificar o acesso (erro de configuração do servidor). Avise o time técnico.",
} as const;

const emailSchema = z.email().transform(normalizeEmail);
const codeSchema = (len: number) => z.string().trim().regex(new RegExp(`^\\d{${len}}$`));

/** Whitelist lookup that turns infra/config errors into a clear message. */
async function checkWhitelist(email: string): Promise<{ allowed: AllowedUser | null } | Fail> {
  try {
    return { allowed: await findAllowedUser(email) };
  } catch {
    return { ok: false, error: MSG.config };
  }
}

function authErrorMessage(error: unknown, fallback: string) {
  if (isAuthApiError(error) && error.status === 429) return MSG.rateLimited;
  return fallback;
}

// ---------------------------------------------------------------------------
// Step 1 — e-mail → whitelist → send e-mail code
// ---------------------------------------------------------------------------
export async function requestEmailCode(rawEmail: string): Promise<Ok | Fail> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: MSG.invalidEmail };
  const email = parsed.data;

  const check = await checkWhitelist(email);
  if ("ok" in check) return check;
  if (!check.allowed) {
    await audit("login_denied_not_allowed", { email });
    return { ok: false, error: MSG.notAllowed };
  }

  const supabase = await createClient();
  // Drop any half-finished session from another account on this browser.
  await supabase.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Whitelisted users get their auth account on first login. The DB hook
    // `hook_before_user_created` blocks anyone outside the whitelist anyway.
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error("[auth] signInWithOtp failed", { status: error.status, code: error.code, message: error.message });
    await audit("email_code_failed", { email, metadata: { status: error.status, code: error.code } });
    return { ok: false, error: authErrorMessage(error, MSG.generic) };
  }

  await audit("email_code_sent", { email });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 2 — verify e-mail code → decide second factor
// ---------------------------------------------------------------------------
export async function verifyEmailCode(
  rawEmail: string,
  rawCode: string,
): Promise<Ok<{ factor: SecondFactor }> | Fail> {
  const email = emailSchema.safeParse(rawEmail);
  const code = codeSchema(AUTH.emailOtpLength).safeParse(rawCode);
  if (!email.success || !code.success) {
    console.error("[auth] verifyEmailCode: formato inválido", { codeLength: rawCode.trim().length, expected: AUTH.emailOtpLength });
    return { ok: false, error: MSG.badEmailCode };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });

  if (error || !data.user) {
    console.error("[auth] verifyOtp failed", error && { status: error.status, code: error.code, message: error.message });
    return { ok: false, error: authErrorMessage(error, MSG.badEmailCode) };
  }

  // Re-check: the user may have been deactivated after the code was sent.
  const check = await checkWhitelist(email.data);
  if ("ok" in check) {
    await supabase.auth.signOut({ scope: "local" });
    return check;
  }
  if (!check.allowed) {
    await supabase.auth.signOut({ scope: "local" });
    await audit("login_denied_not_allowed", { email: email.data, userId: data.user.id });
    return { ok: false, error: MSG.notAllowed };
  }

  await audit("email_code_verified", { email: email.data, userId: data.user.id });
  return resolveSecondFactor(supabase, data.user.id, email.data);
}

/** Called when /login is reopened with an aal1 session (e.g. after refresh). */
export async function resumeSecondFactor(): Promise<Ok<{ factor: SecondFactor }> | Fail> {
  const state = await getSessionState();
  if (state.status === "authenticated") return { ok: true, factor: { next: "done" } };
  if (state.status !== "needs_mfa") return { ok: false, error: MSG.sessionLost };
  return resolveSecondFactor(await createClient(), state.userId, state.email);
}

async function resolveSecondFactor(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<Ok<{ factor: SecondFactor }> | Fail> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("[auth] listFactors failed", { status: error.status, code: error.code, message: error.message });
    return { ok: false, error: MSG.generic };
  }

  const verified = factors.totp[0];

  if (verified && (await isTrustedDevice(userId))) {
    await touchTrustedDevice(userId);
    await audit("trusted_device_used", { email, userId });
    return { ok: true, factor: { next: "done" } };
  }

  if (verified) return { ok: true, factor: { next: "verify", factorId: verified.id } };

  // First access: clean up abandoned enrollments, then enroll a new TOTP factor.
  for (const f of factors.all) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Painel de Entregas",
    issuer: "Mantiqueira · Painel de Entregas",
  });
  if (enrollError || !enrolled) {
    console.error("[auth] mfa.enroll failed", enrollError && { status: enrollError.status, code: enrollError.code, message: enrollError.message });
    return { ok: false, error: MSG.generic };
  }

  return {
    ok: true,
    factor: {
      next: "enroll",
      factorId: enrolled.id,
      qrCode: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 3 — verify authenticator code (+ optionally trust this computer)
// ---------------------------------------------------------------------------
export async function verifyTotp(input: {
  factorId: string;
  code: string;
  trustDevice: boolean;
  enrolling: boolean;
}): Promise<Ok | Fail> {
  const code = codeSchema(AUTH.totpLength).safeParse(input.code);
  const factorId = z.uuid().safeParse(input.factorId);
  if (!code.success || !factorId.success) return { ok: false, error: MSG.badTotp };

  const state = await getSessionState();
  if (state.status === "anonymous" || state.status === "not_allowed") {
    return { ok: false, error: MSG.sessionLost };
  }
  const userId = state.status === "needs_mfa" ? state.userId : state.user.authId;
  const email = state.status === "needs_mfa" ? state.email : state.user.email;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId.data,
    code: code.data,
  });

  if (error) {
    await audit("mfa_failed", { email, userId, metadata: { status: error.status } });
    return { ok: false, error: authErrorMessage(error, MSG.badTotp) };
  }

  await audit(input.enrolling ? "mfa_enrolled" : "mfa_verified", { email, userId });

  if (input.trustDevice) {
    try {
      await trustThisDevice(userId);
      await audit("trusted_device_created", { email, userId });
    } catch (err) {
      // Login still succeeds; the user will just be asked for the code next time.
      console.error("[auth] trust device failed", err);
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// "Trocar" — start over with another e-mail
// ---------------------------------------------------------------------------
export async function switchAccount(): Promise<Ok> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return { ok: true };
}
