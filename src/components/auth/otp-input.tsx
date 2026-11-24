"use client";

import { useEffect, useRef } from "react";

type Props = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  autoFocus?: boolean;
};

/** 6 boxes of 65×56 (Figma "inp"), auto-advance, paste and backspace support. */
export function OtpInput({ length, value, onChange, onComplete, disabled, invalid, label, autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  // Focus the first empty box once the field becomes usable (after a step change
  // or after a failed attempt clears the value).
  useEffect(() => {
    if (autoFocus && !disabled) focus(value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  return (
    <div role="group" aria-label={label} className="grid grid-cols-6 gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label} — dígito ${i + 1}`}
          aria-invalid={invalid || undefined}
          maxLength={length}
          className={`h-14 w-full rounded-[10px] border bg-white text-center font-mono text-[24px] text-grafite outline-none transition
            focus:border-verde focus:ring-2 focus:ring-verde/20 disabled:bg-desabilitado disabled:text-desabilitado-texto
            ${invalid ? "border-erro" : d ? "border-verde" : "border-borda-forte"}`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const typed = e.currentTarget.value.replace(/\D/g, "");
            if (!typed) return;
            if (typed.length > 1) {
              // Paste or SMS/autofill into a single box.
              commit(value.slice(0, i) + typed);
              focus(i + typed.length);
              return;
            }
            const arr = value.split("");
            arr[Math.min(i, value.length)] = typed;
            commit(arr.join(""));
            focus(Math.min(i, value.length) + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) {
                onChange(value.slice(0, i) + value.slice(i + 1));
              } else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focus(i - 1);
              }
            } else if (e.key === "ArrowLeft") {
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!pasted) return;
            commit(value.slice(0, i) + pasted);
            focus(i + pasted.length);
          }}
        />
      ))}
    </div>
  );
}
