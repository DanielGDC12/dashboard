"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ITEM_ACTIVE, ITEM_BASE, ITEM_IDLE, NAV_ITEMS, isActive } from "./nav-items";


export function SidebarLinks() {
  const pathname = usePathname();
  return <LinkList pathname={pathname} />;
}

/** Sem pathname (prerender com parâmetro dinâmico): nenhum item ativo. */
export function SidebarLinksFallback() {
  return <LinkList pathname={null} />;
}

function LinkList({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${ITEM_BASE} ${active ? ITEM_ACTIVE : ITEM_IDLE} lg:w-[200px]`}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              {active && <ChevronIcon />}
            </Link>
          </li>
        );
      })}
    </>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="ml-auto hidden size-4 shrink-0 lg:block" fill="none">
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
