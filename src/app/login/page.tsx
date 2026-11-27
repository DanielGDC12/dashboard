import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionState } from "@/lib/auth/dal";
import { getRememberedEmail } from "@/lib/auth/trusted-device";
import { getLoginStatus } from "@/lib/auth/mfa-login";
import { BrandPanel } from "@/components/auth/brand-panel";
import { LoginFlow } from "@/components/auth/login-flow";

export const metadata: Metadata = { title: "Entrar · Painel de Entregas" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <BrandPanel />
      <section className="flex flex-1 justify-center px-6 py-10 lg:px-10 lg:py-20">
        <div className="w-full max-w-[440px]">
          <Suspense fallback={<LoginFlow initial={{ step: "email" }} />}>
            <LoginGate />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

/** Reads the session (request-time) and decides where the flow starts. */
async function LoginGate() {
  const state = await getSessionState();

  if (state.status === "authenticated") redirect("/");
  if (state.status === "needs_mfa") {
    return <LoginFlow initial={{ step: "authenticator", email: state.email, source: "session" }} />;
  }
  if (state.status === "not_allowed") {
    return (
      <LoginFlow
        initial={{
          step: "email",
          error:
            "Este e-mail não tem acesso ao Painel de Entregas. Peça um convite a um administrador.",
        }}
      />
    );
  }

  // Computador lembrado: e-mail preenchido, direto para o código do app autenticador.
  const remembered = await getRememberedEmail().catch(() => null);
  const hasAuthenticator = remembered
    ? Boolean((await getLoginStatus(remembered).catch(() => null))?.totpFactorId)
    : false;
  if (remembered && hasAuthenticator) {
    return <LoginFlow initial={{ step: "authenticator", email: remembered, source: "remembered" }} />;
  }
  return <LoginFlow initial={{ step: "email" }} />;
}
