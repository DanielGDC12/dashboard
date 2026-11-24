const STEPS = ["E-mail", "Código", "Autenticador"] as const;

/** Figma "step": 3 columns, 23 px circles joined by 2 px lines. */
export function Stepper({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="grid grid-cols-3" aria-label="Etapas do login">
      {STEPS.map((label, i) => {
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
