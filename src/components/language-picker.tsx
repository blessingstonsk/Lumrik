"use client";
import { Check } from "lucide-react";
import type { LanguageRow } from "@/lib/data/content";
import { fontClassFor } from "@/lib/languages";
import { cn } from "@/lib/utils";

export function LanguageGrid({
  languages,
  value,
  onChange,
  disabledCode,
  badge,
  label,
}: {
  languages: LanguageRow[];
  value: string | null;
  onChange: (code: string) => void;
  disabledCode?: string;
  badge?: (code: string) => React.ReactNode;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {languages.map((l) => {
        const selected = value === l.code;
        const disabled = disabledCode === l.code;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(l.code)}
            className={cn(
              "relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
              selected ? "border-primary bg-indigo-500/10" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold", selected ? "bg-primary text-white" : "bg-surface-2 text-primary", fontClassFor(l.code))}>
              {l.glyph}
            </span>
            <span className="min-w-0">
              <span className={cn("block truncate font-bold", fontClassFor(l.code))} lang={l.code}>
                {l.nativeName}
              </span>
              <span className="block truncate text-xs text-muted">
                {l.flag} {l.name}
              </span>
              {badge?.(l.code)}
            </span>
            {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
