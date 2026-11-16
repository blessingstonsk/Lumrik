"use client";
import { Check } from "lucide-react";
import type { LanguageRow } from "@/lib/data/content";
import { fontClassFor } from "@/lib/languages";
import { cn } from "@/lib/utils";

function Tile({
  l,
  selected,
  disabled,
  role,
  onClick,
  badge,
  order,
}: {
  l: LanguageRow;
  selected: boolean;
  disabled?: boolean;
  role: "radio" | "checkbox";
  onClick: () => void;
  badge?: React.ReactNode;
  order?: number;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
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
        {badge}
      </span>
      {selected &&
        (order !== undefined ? (
          <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{order === 0 ? "Main" : order + 1}</span>
        ) : (
          <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden />
        ))}
    </button>
  );
}

/** Single-choice language grid (radio group). */
export function LanguageGrid({
  languages,
  value,
  onChange,
  disabledCode,
  disabledCodes,
  badge,
  label,
}: {
  languages: LanguageRow[];
  value: string | null;
  onChange: (code: string) => void;
  disabledCode?: string;
  disabledCodes?: string[];
  badge?: (code: string) => React.ReactNode;
  label: string;
}) {
  const off = new Set([...(disabledCodes ?? []), ...(disabledCode ? [disabledCode] : [])]);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {languages.map((l) => (
        <Tile key={l.code} l={l} role="radio" selected={value === l.code} disabled={off.has(l.code)} onClick={() => onChange(l.code)} badge={badge?.(l.code)} />
      ))}
    </div>
  );
}

/** Multi-choice language grid. The first selected language is the learner's main language. */
export function LanguageMultiGrid({
  languages,
  value,
  onChange,
  disabledCodes,
  label,
}: {
  languages: LanguageRow[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabledCodes?: string[];
  label: string;
}) {
  const off = new Set(disabledCodes ?? []);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {languages.map((l) => {
        const i = value.indexOf(l.code);
        return <Tile key={l.code} l={l} role="checkbox" selected={i >= 0} order={i >= 0 ? i : undefined} disabled={off.has(l.code)} onClick={() => toggle(l.code)} />;
      })}
    </div>
  );
}

/** Lets the learner choose which spoken language is the main one. */
export function MainLanguageChips({ languages, value, onChange }: { languages: LanguageRow[]; value: string[]; onChange: (codes: string[]) => void }) {
  if (value.length < 2) return null;
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-3">
      <p className="mb-2 text-sm font-semibold">Main language for explanations</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Main language">
        {value.map((code, i) => {
          const l = languages.find((x) => x.code === code);
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={i === 0}
              onClick={() => onChange([code, ...value.filter((c) => c !== code)])}
              className={cn("rounded-full border-2 px-3 py-1 text-sm font-semibold", i === 0 ? "border-primary bg-primary text-white" : "border-border bg-surface hover:bg-surface")}
            >
              {l?.nativeName ?? code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
