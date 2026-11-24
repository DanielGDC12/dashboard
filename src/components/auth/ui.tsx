import type { ButtonHTMLAttributes, ReactNode } from "react";
import { publicEnv } from "@/lib/env";

export function EnvBadge() {
  const hlg = publicEnv.appEnv === "hlg";
  return (
    <span
      className={`inline-flex h-[25px] items-center gap-2 rounded-full px-3 text-[12px] font-bold uppercase tracking-[0.6px] ${
        hlg ? "bg-atencao-claro text-atencao-texto ring-1 ring-atencao" : "bg-verde-claro text-verde"
      }`}
    >
      <span aria-hidden className={`size-2 rounded-full ${hlg ? "bg-atencao" : "bg-verde"}`} />
      {hlg ? "HLG" : "Produção"}
    </span>
  );
}

export function PrimaryButton({
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-verde text-[15px] font-semibold text-white transition hover:bg-[#00463a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde disabled:bg-desabilitado disabled:text-desabilitado-texto"
    >
      {loading && (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  );
}

export function LinkButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`text-[14px] font-semibold text-verde underline underline-offset-2 hover:text-[#00463a] disabled:text-desabilitado-texto disabled:no-underline ${props.className ?? ""}`}
    />
  );
}

export function Alert({ tone, children }: { tone: "error" | "info" | "warning"; children: ReactNode }) {
  const styles = {
    error: "bg-erro-claro border-erro text-erro",
    info: "bg-verde-claro border-verde text-grafite",
    warning: "bg-atencao-claro border-atencao text-atencao-texto",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border-l-4 px-4 py-3 text-[14px] leading-[1.45] ${styles}`}>
      {children}
    </div>
  );
}

export function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[10px] border-l-4 border-verde bg-verde-claro px-4 py-3.5 text-[14px] leading-[1.45] text-grafite">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-verde" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v6M12 7.5v.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <p>{children}</p>
    </div>
  );
}
