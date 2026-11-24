import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "./actions";

const ROLE_LABEL = { gestao: "Gestão", logistica: "Logística", atendimento: "Atendimento" } as const;

export default function PainelHome() {
  return (
    <main className="mx-auto w-full max-w-[1366px] px-6 py-10 lg:px-[50px]">
      <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-verde">Painel de Entregas</p>
      <Suspense fallback={<p className="mt-4 text-texto-secundario">Carregando…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const user = await requireUser();
  return (
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold tracking-[-0.3px]">
          Olá, {user.fullName?.split(" ")[0] ?? user.email}
        </h1>
        <p className="mt-1 text-[15px] text-texto-secundario">
          {user.email} · perfil {ROLE_LABEL[user.role]}
          {user.viaTrustedDevice && " · computador confiável"}
        </p>
      </div>
      <form action={signOut}>
        <button className="h-[34px] rounded-full border border-borda-forte px-4 text-[14px] font-semibold hover:border-grafite">
          Sair
        </button>
      </form>
    </div>
  );
}
