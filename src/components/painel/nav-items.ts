/** Itens do menu lateral — Figma "02a · Território — Brasil" › mnav. */
export type NavItem = {
  label: string;
  href: string;
  /** Prefixos de rota que também deixam o item ativo. */
  match: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Território", href: "/", match: ["/territorio"] },
  { label: "Publicações", href: "/publicacoes", match: ["/publicacoes"] },
  { label: "Insights", href: "/insights", match: ["/insights"] },
  { label: "Integrações", href: "/integracoes", match: ["/integracoes"] },
  { label: "Usuários e auditoria", href: "/usuarios", match: ["/usuarios"] },
];

export function isActive(item: NavItem, pathname: string | null) {
  if (!pathname) return false;
  if (pathname === item.href) return true;
  return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/*
 * Classes dos itens (200 × 40, raio 4, texto 15, padding 20). Ficam aqui, fora do
 * módulo "use client", porque o Sair (Server Component) também usa: constantes
 * importadas de um módulo client chegam ao servidor como referência, não como string.
 */
export const ITEM_BASE =
  "flex h-10 shrink-0 items-center gap-3 rounded-[4px] px-5 text-[15px] leading-[21.8px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde";
export const ITEM_IDLE = "bg-cinza font-semibold text-grafite hover:bg-[#E2E2E2]";
export const ITEM_ACTIVE = "bg-grafite font-bold text-white";
