/**
 * Sticky composer at the bottom of the board.
 *
 * OTP-style: four individual digit inputs with auto-advance on entry
 * and backspace-to-previous on delete. Eliminates the footgun of typing
 * a single digit into an invisible buffer and seeing it multiply onto
 * every tile, and it makes the field feel purpose-built for 4-digit
 * codes instead of a generic text box.
 *
 * Typing a digit that's already present in the code is allowed at the
 * input level (so you can overwrite a slot); the server-side validator
 * will flag duplicates when you submit.
 */
import { useEffect, useRef } from "react";
import { sounds } from "../../../lib/sounds";

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  submitLabel,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  submitLabel: string;
  error: string | null;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Autofocus the first empty slot when the board becomes interactive.
  useEffect(() => {
    if (disabled) return;
    const firstEmpty = refs.findIndex((r) => !(r.current?.value ?? ""));
    const idx = firstEmpty === -1 ? 0 : firstEmpty;
    refs[idx]?.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function setDigitAt(idx: number, ch: string) {
    const chars = value.padEnd(4, " ").split("");
    chars[idx] = ch || " ";
    const next = chars.join("").replace(/\s+/g, "");
    onChange(next);
  }

  function handleChange(idx: number, raw: string) {
    const digit = (raw.match(/\d/)?.[0] ?? "").slice(0, 1);
    if (!digit) {
      setDigitAt(idx, "");
      return;
    }
    setDigitAt(idx, digit);
    sounds.digitTap();
    if (idx < 3) refs[idx + 1]?.current?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Backspace") {
      const current = value[idx] ?? "";
      if (!current && idx > 0) {
        refs[idx - 1]?.current?.focus();
        setDigitAt(idx - 1, "");
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowLeft" && idx > 0) {
      refs[idx - 1]?.current?.focus();
      e.preventDefault();
    }
    if (e.key === "ArrowRight" && idx < 3) {
      refs[idx + 1]?.current?.focus();
      e.preventDefault();
    }
  }

  function handlePaste(idx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4 - idx);
    if (!pasted) return;
    e.preventDefault();
    const chars = value.padEnd(4, " ").split("");
    for (let i = 0; i < pasted.length; i++) {
      chars[idx + i] = pasted[i]!;
    }
    onChange(chars.join("").replace(/\s+/g, ""));
    const last = Math.min(idx + pasted.length, 3);
    refs[last]?.current?.focus();
  }

  return (
    <div className="panel-elevated p-3 md:p-4">
      {/* On narrow screens: tiles fill the row; submit button drops below.
          On md+: tiles + button share one row. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => {
            const ch = value[i] ?? "";
            return (
              <input
                key={i}
                ref={refs[i]}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                disabled={disabled}
                value={ch}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={(e) => handlePaste(i, e)}
                onFocus={(e) => e.target.select()}
                aria-label={`Digit ${i + 1}`}
                className={`flex-1 aspect-[4/5] min-w-0 max-w-[64px] rounded-lg border text-center font-mono text-xl sm:text-2xl md:text-3xl tabular-nums transition-colors focus:outline-none ${
                  disabled
                    ? "bg-ink border-ink-border text-fg-dim cursor-not-allowed"
                    : ch
                      ? "bg-ink-elevated border-accent/40 text-fg-primary focus:border-accent"
                      : "bg-ink border-ink-border text-fg-muted focus:border-accent/40"
                }`}
              />
            );
          })}
        </div>

        <button
          className="btn-primary shrink-0 w-full sm:w-auto"
          disabled={disabled || value.length !== 4}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] uppercase tracking-[0.22em] gap-3">
        <span className="text-fg-muted truncate">{placeholder}</span>
        <span
          className={`whitespace-nowrap ${error ? "text-danger" : "text-fg-muted"}`}
        >
          {error ?? "↵ to submit"}
        </span>
      </div>
    </div>
  );
}
