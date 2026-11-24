"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AUTH } from "@/lib/env";
import {
  requestEmailCode,
  resumeSecondFactor,
  switchAccount,
  verifyEmailCode,
  verifyTotp,
  type SecondFactor,
} from "@/app/login/actions";
import { OtpInput } from "./otp-input";
import { Stepper } from "./stepper";
import { Alert, EnvBadge, InfoCallout, LinkButton, PrimaryButton } from "./ui";

type Initial =
  | { step: "email"; error?: string }
  | { step: "authenticator"; email: string };

type Step = "email" | "code" | "authenticator";

const RESEND_SECONDS = 60;

export function LoginFlow({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(initial.step);
  const [email, setEmail] = useState(initial.step === "authenticator" ? initial.email : "");
  const [emailCode, setEmailCode] = useState("");
  const [totp, setTotp] = useState("");
  const [trust, setTrust] = useState(false);
  const [factor, setFactor] = useState<Exclude<SecondFactor, { next: "done" }> | null>(null);
  const [error, setError] = useState<string | null>(initial.step === "email" ? initial.error ?? null : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [showLostHelp, setShowLostHelp] = useState(false);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Landing directly on step 3 (aal1 session after reload): load factor info.
  useEffect(() => {
    if (initial.step !== "authenticator") return;
    startTransition(async () => {
      const res = await resumeSecondFactor();
      if (!res.ok) {
        setStep("email");
        setError(res.error);
        return;
      }
      handleFactor(res.factor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToPanel() {
    router.replace("/");
    router.refresh();
  }

  function handleFactor(f: SecondFactor) {
    if (f.next === "done") return goToPanel();
    setFactor(f);
    setTotp("");
    setStep("authenticator");
  }

  // ---- Step 1
  function submitEmail(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await requestEmailCode(email);
      if (!res.ok) return setError(res.error);
      setEmailCode("");
      setResendIn(RESEND_SECONDS);
      setStep("code");
    });
  }

  function resend() {
    setError(null);
    startTransition(async () => {
      const res = await requestEmailCode(email);
      if (!res.ok) return setError(res.error);
      setResendIn(RESEND_SECONDS);
      setNotice(`Enviamos um novo código para ${email}.`);
    });
  }

  // ---- Step 2
  function submitEmailCode(code = emailCode) {
    if (code.length !== AUTH.emailOtpLength) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await verifyEmailCode(email, code);
      if (!res.ok) {
        setEmailCode("");
        return setError(res.error);
      }
      handleFactor(res.factor);
    });
  }

  // ---- Step 3
  function submitTotp(code = totp) {
    if (!factor || code.length !== AUTH.totpLength) return;
    setError(null);
    startTransition(async () => {
      const res = await verifyTotp({
        factorId: factor.factorId,
        code,
        trustDevice: trust,
        enrolling: factor.next === "enroll",
      });
      if (!res.ok) {
        setTotp("");
        return setError(res.error);
      }
      goToPanel();
    });
  }

  function changeAccount() {
    startTransition(async () => {
      await switchAccount();
      setStep("email");
      setFactor(null);
      setEmailCode("");
      setTotp("");
      setError(null);
      setNotice(null);
      setShowLostHelp(false);
    });
  }

  const stepIndex = step === "email" ? 0 : step === "code" ? 1 : 2;

  return (
    <div className="flex flex-col">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-[32px] font-bold leading-10 tracking-[-0.3px]">Entrar</h1>
        <div className="pt-[7px]">
          <EnvBadge />
        </div>
      </header>

      <div className="mt-[26px]">
        <Stepper current={stepIndex} />
      </div>

      {step !== "email" && (
        <div className="mt-[26px] flex items-center gap-1.5 rounded-[10px] bg-fundo-bloco px-4 py-3 text-[15px]">
          <span className="shrink-0 text-texto-secundario">Entrando como</span>
          <strong className="min-w-0 truncate font-semibold">{email}</strong>
          <LinkButton className="ml-auto" onClick={changeAccount} disabled={pending}>
            Trocar
          </LinkButton>
        </div>
      )}

      <div className="mt-[26px] flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && !error && <Alert tone="info">{notice}</Alert>}

        {/* ------------------------------------------------ Step 1: e-mail */}
        {step === "email" && (
          <form onSubmit={submitEmail} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[15px] font-semibold">
                E-mail corporativo
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@mantiqueirabrasil.com.br"
                className="h-11 rounded-full border border-transparent bg-cinza px-5 text-[15px] outline-none placeholder:text-texto-secundario focus:border-verde focus:bg-white focus:ring-2 focus:ring-verde/20"
              />
              <p className="text-[13px] text-texto-secundario">
                Vamos enviar um código de {AUTH.emailOtpLength} dígitos para este e-mail.
              </p>
            </div>
            <PrimaryButton type="submit" loading={pending} disabled={!email.trim()}>
              Enviar código
            </PrimaryButton>
          </form>
        )}

        {/* ------------------------------------------------ Step 2: e-mail code */}
        {step === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEmailCode();
            }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <p className="text-[15px] font-semibold">Código enviado por e-mail</p>
              <p className="text-[14px] leading-[1.45] text-texto-secundario">
                Digite o código de {AUTH.emailOtpLength} dígitos que enviamos para a sua caixa de
                entrada. Confira também o spam.
              </p>
              <div className="mt-2">
                <OtpInput
                  label="Código do e-mail"
                  length={AUTH.emailOtpLength}
                  value={emailCode}
                  onChange={setEmailCode}
                  onComplete={submitEmailCode}
                  disabled={pending}
                  invalid={Boolean(error)}
                  autoFocus
                />
              </div>
            </div>
            <PrimaryButton type="submit" loading={pending} disabled={emailCode.length !== AUTH.emailOtpLength}>
              Continuar
            </PrimaryButton>
            <div className="flex justify-between text-[14px]">
              <LinkButton onClick={resend} disabled={pending || resendIn > 0}>
                {resendIn > 0 ? `Não recebi o código (${resendIn}s)` : "Não recebi o código"}
              </LinkButton>
            </div>
          </form>
        )}

        {/* ------------------------------------------------ Step 3: authenticator */}
        {step === "authenticator" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitTotp();
            }}
            className="flex flex-col gap-5"
          >
            {!factor ? (
              <p className="text-[14px] text-texto-secundario" role="status">
                Carregando autenticador…
              </p>
            ) : (
              <>
                {factor.next === "enroll" && <EnrollTotp qrCode={factor.qrCode} secret={factor.secret} />}

                <div className="flex flex-col gap-2">
                  <p className="text-[15px] font-semibold">Código do app autenticador</p>
                  <p className="text-[14px] leading-[1.45] text-texto-secundario">
                    {factor.next === "enroll"
                      ? `Depois de escanear, digite o código de ${AUTH.totpLength} dígitos que aparece no app.`
                      : `Abra o Google Authenticator ou Microsoft Authenticator e digite o código de ${AUTH.totpLength} dígitos.`}
                  </p>
                  <div className="mt-2">
                    <OtpInput
                      label="Código do autenticador"
                      length={AUTH.totpLength}
                      value={totp}
                      onChange={setTotp}
                      disabled={pending}
                      invalid={Boolean(error)}
                      autoFocus
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                  <input
                    type="checkbox"
                    checked={trust}
                    onChange={(e) => setTrust(e.target.checked)}
                    className="size-5 cursor-pointer rounded accent-verde"
                  />
                  Confiar neste computador por {AUTH.trustedDeviceDays} dias
                </label>

                <PrimaryButton type="submit" loading={pending} disabled={totp.length !== AUTH.totpLength}>
                  Entrar no painel
                </PrimaryButton>

                {factor.next === "verify" && (
                  <div className="flex justify-end">
                    <LinkButton onClick={() => setShowLostHelp((v) => !v)} aria-expanded={showLostHelp}>
                      Perdi o acesso ao autenticador
                    </LinkButton>
                  </div>
                )}
                {showLostHelp && (
                  <Alert tone="warning">
                    Peça a um administrador do painel para redefinir o seu autenticador em
                    <strong> Usuários e auditoria</strong>. No próximo login você vai configurar um novo app.
                  </Alert>
                )}
              </>
            )}
          </form>
        )}

        <InfoCallout>
          <strong>Primeiro acesso?</strong> O convite chegou por e-mail. Entre com o mesmo endereço e
          configure o app autenticador quando for pedido.
        </InfoCallout>
      </div>
    </div>
  );
}

function EnrollTotp({ qrCode, secret }: { qrCode: string; secret: string }) {
  const [showSecret, setShowSecret] = useState(false);
  const src = qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
  return (
    <div className="flex flex-col gap-4 rounded-[10px] border border-borda bg-white p-5 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR code para configurar o app autenticador" className="size-[148px] shrink-0 self-center" />
      <div className="flex flex-col gap-2 text-[14px] leading-[1.45]">
        <p className="text-[15px] font-semibold">Configure o autenticador</p>
        <ol className="list-decimal pl-4 text-texto-secundario">
          <li>Instale o Google Authenticator ou Microsoft Authenticator.</li>
          <li>Toque em “Adicionar” e escaneie o QR code.</li>
        </ol>
        {showSecret ? (
          <code className="break-all rounded-md bg-fundo-bloco px-2 py-1 font-mono text-[12.5px] select-all">
            {secret}
          </code>
        ) : (
          <LinkButton className="self-start" onClick={() => setShowSecret(true)}>
            Não consigo escanear
          </LinkButton>
        )}
      </div>
    </div>
  );
}
