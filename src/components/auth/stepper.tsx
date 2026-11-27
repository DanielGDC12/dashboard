/**
 * Figma "step": one column per step, 23 px circles joined by 2 px lines.
 * Primeiro acesso: E-mail · Código · Autenticador. Acessos seguintes: E-mail · Autenticador.
 */
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol
      className="grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="Etapas do login"
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            className="relative flex flex-col items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-[11px] h-0.5 ${i <= current ? "bg-verde" : "bg-borda"}`}
                style={{ left: "calc(-50% + 11.5px)", right: "calc(50% + 11.5px)" }}
              />
            )}
            <span
              className={`relative z-10 flex size-[23px] items-center justify-center rounded-full border-2 ${
                done
                  ? "border-verde bg-verde text-white"
                  : active
                    ? "border-verde bg-white"
                    : "border-borda-forte bg-white"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 13 13" className="size-[13px]" aria-hidden>
                  <path d="M2.5 6.8 5.2 9.3 10.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <span className="size-[9px] rounded-full bg-verde" />
              ) : null}
            </span>
            <span
              className={`text-[13px] ${
                active ? "font-bold text-grafite" : done ? "font-semibold text-verde" : "text-texto-secundario"
              }`}
            >
              {label}
              {done && <span className="sr-only"> (concluído)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
