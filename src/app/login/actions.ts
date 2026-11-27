"use server";

import { z } from "zod";
import { isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { findAllowedUser, normalizeEmail, type AllowedUser } from "@/lib/auth/whitelist";
import { forgetThisDevice, rememberThisDevice } from "@/lib/auth/trusted-device";
import { getLoginStatus, isLockedOut, signInWithTotp, type LoginStatus } from "@/lib/auth/mfa-login";
import { audit } from "@/lib/auth/audit";
import { getSessionState } from "@/lib/auth/dal";

// ---------------------------------------------------------------------------
// Fluxo
//   Primeiro acesso: e-mail → código por e-mail → cadastro do app autenticador.
//   Acessos seguintes: e-mail → código do app autenticador (sem e-mail).
// ---------------------------------------------------------------------------
export type SecondFactor =
  | { next: "done" }
  /** Já existe sessão aal1 (veio do código por e-mail): verificar TOTP nela. */
  | { next: "verify"; factorId: string }
  /** Primeiro acesso: cadastrar o app autenticador. */
  | { next: "enroll"; factorId: string; qrCode: string; secret: string }
  /** Acesso recorrente: login só com o código do app (sem sessão prévia). */
  | { next: "login" };

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;

const MSG = {
  invalidEmail: "Digite um e-mail válido.",
  notAllowed:
    "Este e-mail não tem acesso ao Painel de Entregas. Peça um convite a um administrador.",
  rateLimited: "Muitas tentativas. Aguarde um minuto e tente de novo.",
  lockedOut:
    "Muitos códigos incorretos. Por segurança, o login deste e-mail foi bloqueado por alguns minutos. Tente de novo mais tarde ou fale com um administrador.",
  badEmailCode: "Código inválido ou expirado. Confira o e-mail ou peça um novo código.",
  badTotp: "Código incorreto. Confira se o horário do celular está automático e tente de novo.",
  noAuthenticator: "Este e-mail ainda não tem um app autenticador configurado. Comece de novo pelo e-mail.",
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

async function checkLoginStatus(email: string): Promise<{ status: LoginStatus } | Fail> {
  try {
    return { status: await getLoginStatus(email) };
  } catch (err) {
    console.error("[auth] login status failed", err);
    return { ok: false, error: MSG.config };
  }
}

function authErrorMessage(error: unknown, fallback: string) {
  if (isAuthApiError(error) && error.status === 429) return MSG.rateLimited;
  return fallback;
}

async function sendEmailCode(email: string): Promise<Ok | Fail> {
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
// Step 1 — e-mail → whitelist → primeiro acesso (código por e-mail) ou TOTP
// ---------------------------------------------------------------------------
export async function startLogin(rawEmail: string): Promise<Ok<{ next: "code" | "totp" }> | Fail> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: MSG.invalidEmail };
  const email = parsed.data;

  const check = await checkWhitelist(email);
  if ("ok" in check) return check;
  if (!check.allowed) {
    await audit("login_denied_not_allowed", { email });
    return { ok: false, error: MSG.notAllowed };
  }

  const login = await checkLoginStatus(email);
  if ("ok" in login) return login;

  if (login.status.totpFactorId) {
    // Acesso recorrente: só o código do app autenticador.
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
    return { ok: true, next: "totp" };
  }

  const sent = await sendEmailCode(email);
  if (!sent.ok) return sent;
  return { ok: true, next: "code" };
}

/** "Não recebi o código" (só no primeiro acesso). */
export async function requestEmailCode(rawEmail: string): Promise<Ok | Fail> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: MSG.invalidEmail };

  const check = await checkWhitelist(parsed.data);
  if ("ok" in check) return check;
  if (!check.allowed) {
    await audit("login_denied_not_allowed", { email: parsed.data });
    return { ok: false, error: MSG.notAllowed };
  }
  return sendEmailCode(parsed.data);
}

// ---------------------------------------------------------------------------
// Step 2 (primeiro acesso) — verify e-mail code → cadastrar autenticador
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
  return resolveSecondFactor(supabase);
}

/** Called when /login is reopened with an aal1 session (e.g. after refresh). */
export async function resumeSecondFactor(): Promise<Ok<{ factor: SecondFactor }> | Fail> {
  const state = await getSessionState();
  if (state.status === "authenticated") return { ok: true, factor: { next: "done" } };
  if (state.status !== "needs_mfa") return { ok: false, error: MSG.sessionLost };
  return resolveSecondFactor(await createClient());
}

async function resolveSecondFactor(supabase: SupabaseClient): Promise<Ok<{ factor: SecondFactor }> | Fail> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("[auth] listFactors failed", { status: error.status, code: error.code, message: error.message });
    return { ok: false, error: MSG.generic };
  }

  const verified = factors.totp[0];
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

/** Grava ou esquece o "lembrar meu e-mail" depois de um TOTP correto. */
async function applyRememberChoice(remember: boolean, email: string, userId: string) {
  try {
    if (!remember) return await forgetThisDevice();
    const result = await rememberThisDevice(userId);
    await audit(result === "created" ? "trusted_device_created" : "trusted_device_used", { email, userId });
  } catch (err) {
    // O login continua valendo; só não lembramos o e-mail.
    console.error("[auth] remember device failed", err);
  }
}

// ---------------------------------------------------------------------------
// Step 3a — código do app numa sessão aal1 (primeiro acesso / sessão retomada)
// ---------------------------------------------------------------------------
export async function verifyTotp(input: {
  factorId: string;
  code: string;
  rememberDevice: boolean;
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

  if (await isLockedOut(email)) {
    await audit("mfa_login_locked", { email, userId });
    return { ok: false, error: MSG.lockedOut };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId.data,
    code: code.data,
  });

  if (error) {
    await audit("mfa_failed", { email, userId, metadata: { status: error.status, mode: input.enrolling ? "enroll" : "session" } });
    return { ok: false, error: authErrorMessage(error, MSG.badTotp) };
  }

  await audit(input.enrolling ? "mfa_enrolled" : "mfa_verified", { email, userId });
  await applyRememberChoice(input.rememberDevice, email, userId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 3b — acesso recorrente: e-mail + código do app, sem código por e-mail
// ---------------------------------------------------------------------------
export async function verifyTotpLogin(input: {
  email: string;
  code: string;
  rememberDevice: boolean;
}): Promise<Ok | Fail> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, error: MSG.sessionLost };
  const code = codeSchema(AUTH.totpLength).safeParse(input.code);
  if (!code.success) return { ok: false, error: MSG.badTotp };

  const check = await checkWhitelist(email.data);
  if ("ok" in check) return check;
  if (!check.allowed) {
    await audit("login_denied_not_allowed", { email: email.data });
    return { ok: false, error: MSG.notAllowed };
  }

  const login = await checkLoginStatus(email.data);
  if ("ok" in login) return login;
  const { userId, totpFactorId } = login.status;
  if (!userId || !totpFactorId) return { ok: false, error: MSG.noAuthenticator };

  if (await isLockedOut(email.data)) {
    await audit("mfa_login_locked", { email: email.data, userId });
    return { ok: false, error: MSG.lockedOut };
  }

  const result = await signInWithTotp({ email: email.data, factorId: totpFactorId, code: code.data });
  if (!result.ok) {
    if (result.reason === "bad_code") {
      await audit("mfa_failed", { email: email.data, userId, metadata: { status: result.status, mode: "totp_login" } });
      return { ok: false, error: MSG.badTotp };
    }
    return { ok: false, error: result.status === 429 ? MSG.rateLimited : MSG.generic };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
  if (error) {
    console.error("[auth] setSession failed", { status: error.status, code: error.code });
    return { ok: false, error: MSG.generic };
  }

  await audit("mfa_verified", { email: email.data, userId, metadata: { mode: "totp_login" } });
  await applyRememberChoice(input.rememberDevice, email.data, userId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// "Trocar" — start over with another e-mail (e esquece o e-mail lembrado)
// ---------------------------------------------------------------------------
export async function switchAccount(): Promise<Ok> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await forgetThisDevice();
  return { ok: true };
}
