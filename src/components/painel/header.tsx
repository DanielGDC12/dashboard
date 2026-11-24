import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/auth/logo";
import { EnvBadge } from "@/components/auth/ui";
import { requireUser } from "@/lib/auth/dal";
import type { UserRole } from "@/lib/auth/whitelist";

/**
 * Header fixo do Painel de Entregas — Figma "02a · Território — Brasil" › top (2868:588).
 * 1366 × 76, branco, sombra 0 2 10 rgba(0,0,0,.07). Medidas em px do frame.
 */

export const ROLE_LABEL: Record<UserRole, string> = {
  gestao: "Gestão",
  logistica: "Logística",
  atendimento: "Atendimento",
};

/** Rascunho com alterações ainda não publicadas (vem da versão em edição). */
export type PendingChanges = {
  changes: number;
  impactedSubscribers: number;
  reviewHref: string;
};

export function PainelHeader({ pending }: { pending?: PendingChanges | null }) {
  return (
    <header className="sticky top-0 z-40 h-[76px] w-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
      <div className="mx-auto flex h-full w-full max-w-[1366px] items-center gap-[18px] px-5 lg:px-8">
        <Link
          href="/"
          aria-label="Mantiqueira em Casa — início do painel"
          className="shrink-0 text-grafite focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-verde"
        >
          <Logo className="h-[30px] w-auto lg:h-9" />
        </Link>

        <span className="hidden h-7 items-center border-l border-borda pl-4 text-[12px] font-bold uppercase tracking-[1.4px] text-verde md:flex">
          Painel de Entregas
        </span>

        <span className="hidden sm:inline-flex">
          <EnvBadge />
        </span>

        <div className="ml-auto flex items-center gap-5">
          {pending && pending.changes > 0 && <PendingChangesPill {...pending} />}
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const numberBR = new Intl.NumberFormat("pt-BR");

function plural(n: number, one: string, many: string) {
  return `${numberBR.format(n)} ${n === 1 ? one : many}`;
}

export function PendingChangesPill({ changes, impactedSubscribers, reviewHref }: PendingChanges) {
  return (
    <div
      role="status"
      className="flex h-11 items-center gap-3 rounded-full bg-limao pl-4 pr-[5px] text-[15px] leading-none text-grafite"
    >
      <strong className="font-bold">{plural(changes, "alteração pendente", "alterações pendentes")}</strong>
      <span className="hidden text-[#3F4A00] xl:inline">
        {plural(impactedSubscribers, "assinante impactado", "assinantes impactados")}
      </span>
      <Link
        href={reviewHref}
        className="flex h-[34px] items-center rounded-full bg-grafite px-4 font-semibold text-white transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grafite"
      >
        Revisar e publicar
      </Link>
    </div>
  );
}

async function UserChip() {
  const user = await requireUser();
  const name = user.fullName?.trim() || user.email;
  const shortName = user.fullName ? user.fullName.trim().split(/\s+/).slice(0, 2).join(" ") : user.email;

  return (
    <div className="flex items-center gap-2.5" title={`${name} · ${user.email}`}>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-limao text-verde">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="max-w-[160px] truncate text-[14px] font-bold text-grafite">{shortName}</span>
        <span className="text-[12px] text-texto-secundario">{ROLE_LABEL[user.role]}</span>
      </span>
    </div>
  );
}

function UserChipSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-2.5">
      <span className="size-8 rounded-full bg-cinza" />
      <span className="hidden flex-col gap-1.5 sm:flex">
        <span className="h-3 w-20 rounded bg-cinza" />
        <span className="h-2.5 w-12 rounded bg-cinza" />
      </span>
    </div>
  );
}
