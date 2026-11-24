import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "@/app/(painel)/actions";
import { ITEM_BASE, ITEM_IDLE } from "./nav-items";
import { SidebarLinks, SidebarLinksFallback } from "./sidebar-links";

/**
 * Menu lateral do Painel de Entregas — Figma "02a · Território — Brasil" (av, "Olá…", mnav).
 * Coluna de 232 px (32 + 200), saudação a 32 px do header, itens 40 px com passo de 54 px.
 * Abaixo de lg vira uma faixa horizontal com rolagem.
 */
export function Sidebar() {
  return (
    <aside className="shrink-0 border-b border-borda lg:w-[232px] lg:border-b-0 lg:pl-8 lg:pt-8">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>

      <nav aria-label="Menu principal" className="overflow-x-auto px-5 py-3 lg:mt-[22px] lg:overflow-visible lg:p-0">
        <ul className="flex gap-2 lg:flex-col lg:gap-[14px]">
          <Suspense fallback={<SidebarLinksFallback />}>
            <SidebarLinks />
          </Suspense>
          <li>
            <form action={signOut}>
              <button
                type="submit"
                className={`${ITEM_BASE} ${ITEM_IDLE} cursor-pointer lg:w-[200px]`}
              >
                <LogoutIcon />
                Sair
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

async function Greeting() {
  const user = await requireUser();
  const firstName = user.fullName?.trim().split(/\s+/)[0];
  return (
    <div className="hidden items-center gap-2.5 lg:flex">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-limao text-verde">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" strokeLinecap="round" />
        </svg>
      </span>
      <p className="truncate text-[19px] font-bold leading-[27.6px] text-grafite">
        {firstName ? `Olá, ${firstName}!` : "Olá!"}
      </p>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div aria-hidden className="hidden items-center gap-2.5 lg:flex">
      <span className="size-8 rounded-full bg-cinza" />
      <span className="h-4 w-28 rounded bg-cinza" />
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" />
      <path d="M10.5 11 13.5 8l-3-3M13.5 8H6" />
    </svg>
  );
}
