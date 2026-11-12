"use client";
import { motion } from "framer-motion";
import { Mic, MicOff, Play, Snail, Square, Volume2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { useRecognizer, useSpeaker } from "@/lib/speech";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { transcriptScore } from "@/lib/validation";

export interface ExerciseProps {
  exercise: Exercise;
  value: string | null;
  onChange: (v: string | null) => void;
  locked: boolean; // answer checked – inputs are read-only
  locale: string;
  onSkip?: () => void;
}

function useShuffled<T>(items: T[], key: string): T[] {
  // Shuffle once per exercise (stable across re-renders).
  return React.useMemo(() => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function SpeakButton({ text, locale, audioUrl, size = "md", label = "Play audio" }: { text: string; locale: string; audioUrl?: string | null; size?: "md" | "lg"; label?: string }) {
  const { say, speaking, error, supported } = useSpeaker(locale);
  if (!supported && !audioUrl) return <span className="text-xs text-muted">Audio not supported in this browser</span>;
  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={() => say(text, { audioUrl })}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl bg-primary text-white shadow-[0_3px_0_#4338ca] transition active:translate-y-px active:shadow-none",
          size === "lg" ? "h-20 w-20" : "h-11 w-11",
          speaking && "animate-pulse",
        )}
      >
        <Volume2 className={size === "lg" ? "h-9 w-9" : "h-5 w-5"} aria-hidden />
      </button>
      {error && <span className="mt-1 text-xs text-rose-500">{error}</span>}
    </span>
  );
}

function ChoiceButton({ index, label, selected, locked, onClick }: { index: number; label: string; selected: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-semibold transition disabled:cursor-default",
        selected ? "border-primary bg-indigo-500/10 text-primary" : "border-border bg-surface hover:bg-surface-2",
      )}
    >
      <kbd className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-xs text-muted">{index + 1}</kbd>
      <span>{label}</span>
    </button>
  );
}

function useNumberKeys(count: number, onPick: (i: number) => void, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [count, onPick, enabled]);
}

// ── Multiple choice ─────────────────────────────────────────
function MultipleChoice({ exercise, value, onChange, locked, locale }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "multiple_choice" }>;
  useNumberKeys(d.choices.length, (i) => onChange(String(i)), !locked);
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        {d.image && <div className="text-6xl" aria-hidden>{d.image}</div>}
        <p className="font-display text-xl font-bold sm:text-2xl">{d.question}</p>
        {d.speak && <SpeakButton text={d.speak} locale={locale} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.choices.map((c, i) => (
          <ChoiceButton key={i} index={i} label={c} selected={value === String(i)} locked={locked} onClick={() => onChange(String(i))} />
        ))}
      </div>
    </div>
  );
}

// ── Fill in the blank ───────────────────────────────────────
function FillBlank({ exercise, value, onChange, locked }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "fill_blank" }>;
  const [before, after] = d.sentence.split("___");
  const choices = useShuffled(d.choices ?? [], exercise.id);
  useNumberKeys(choices.length, (i) => onChange(choices[i]), !locked && choices.length > 0);
  return (
    <div>
      <p className="mb-6 font-display text-xl font-bold leading-relaxed sm:text-2xl">
        {before}
        {d.choices ? (
          <span className={cn("mx-1 inline-block min-w-20 border-b-4 px-2 text-center", value ? "border-primary text-primary" : "border-border text-transparent")}>{value || "____"}</span>
        ) : (
          <Input
            aria-label="Your answer"
            className="mx-1 inline-block h-10 w-40 align-middle text-base"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={locked}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
        {after}
      </p>
      {d.hint && <p className="mb-4 text-sm text-muted">Hint: {d.hint}</p>}
      {d.choices && (
        <div className="flex flex-wrap gap-3">
          {choices.map((c, i) => (
            <button
              key={c}
              type="button"
              disabled={locked}
              onClick={() => onChange(c)}
              aria-pressed={value === c}
              className={cn("rounded-2xl border-2 px-5 py-3 font-semibold transition", value === c ? "border-primary bg-indigo-500/10 text-primary" : "border-border bg-surface hover:bg-surface-2")}
            >
              <span className="mr-2 text-xs text-muted">{i + 1}</span>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Listening ───────────────────────────────────────────────
function Listening({ exercise, value, onChange, locked, locale, onSkip }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "listening" }>;
  const { say, speaking, supported, error } = useSpeaker(locale);
  React.useEffect(() => {
    if (supported) void say(d.audioText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);
  useNumberKeys(d.choices?.length ?? 0, (i) => onChange(String(i)), !locked && d.mode === "choose");
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => say(d.audioText)}
          aria-label="Play audio"
          disabled={!supported}
          className={cn("flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_4px_0_#4338ca] active:translate-y-px", speaking && "animate-pulse")}
        >
          <Volume2 className="h-9 w-9" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => say(d.audioText, { rate: 0.6 })}
          aria-label="Play slowly"
          disabled={!supported}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-border bg-surface hover:bg-surface-2"
        >
          <Snail className="h-6 w-6 text-primary" aria-hidden />
        </button>
      </div>
      {(!supported || error) && (
        <div className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm">
          {error ?? "Audio playback isn't available in this browser."}{" "}
          {onSkip && (
            <button className="font-semibold text-primary underline" onClick={onSkip}>
              Skip this exercise
            </button>
          )}
        </div>
      )}
      {d.mode === "choose" ? (
        <div className="grid gap-3">
          {d.choices!.map((c, i) => (
            <ChoiceButton key={i} index={i} label={c} selected={value === String(i)} locked={locked} onClick={() => onChange(String(i))} />
          ))}
        </div>
      ) : (
        <Input
          aria-label="Type what you hear"
          placeholder="Type what you hear…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={locked}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-14 text-lg"
        />
      )}
    </div>
  );
}

// ── Speaking ────────────────────────────────────────────────
export function SpeakingFeedback({ expected, heard }: { expected: string; heard: string }) {
  const { score, diff } = transcriptScore(expected, heard);
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="text-xs font-semibold uppercase text-muted">We heard</p>
      <p className="mt-1 text-lg">&ldquo;{heard || "…"}&rdquo;</p>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Word by word feedback">
        {diff.map((w, i) => (
          <span
            key={i}
            className={cn(
              "rounded-lg px-2 py-0.5 text-sm font-semibold",
              w.status === "match" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              w.status === "missing" && "bg-rose-500/15 text-rose-600 line-through dark:text-rose-300",
              w.status === "extra" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
            )}
            title={w.status === "match" ? "Recognised" : w.status === "missing" ? "Not recognised" : "Extra word heard"}
          >
            {w.word}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm">
        <strong>{Math.round(score * 100)}%</strong> of words recognised.{" "}
        <span className="text-muted">Feedback is based on speech-to-text transcription, not an accent score.</span>
      </p>
    </div>
  );
}

function Speaking({ exercise, value, onChange, locked, locale, onSkip }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "speaking" }>;
  const rec = useRecognizer(locale);
  const listening = rec.status === "listening";
  const go = async () => {
    const text = await rec.start();
    if (text) onChange(text);
  };
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <SpeakButton text={d.text} locale={locale} label="Hear the sentence" />
        <p className="font-display text-xl font-bold sm:text-2xl">{d.text}</p>
      </div>
      {!rec.supported ? (
        <div className="rounded-2xl bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">Speech recognition isn&apos;t available in this browser.</p>
          <p className="mt-1 text-muted">Try Chrome, Edge or Safari. You can practise saying the sentence aloud and skip for now – it won&apos;t count against you.</p>
          {onSkip && (
            <Button className="mt-3" variant="outline" size="sm" onClick={onSkip}>
              Skip speaking exercise
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <motion.button
            type="button"
            disabled={locked}
            onClick={listening ? rec.stop : go}
            aria-label={listening ? "Stop recording" : "Start speaking"}
            className={cn("flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition", listening ? "bg-rose-500" : "bg-secondary")}
            animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={listening ? { repeat: Infinity, duration: 1.2 } : {}}
          >
            {listening ? <Square className="h-9 w-9" aria-hidden /> : <Mic className="h-10 w-10" aria-hidden />}
          </motion.button>
          <p className="text-sm text-muted" aria-live="polite">
            {listening ? "Listening… speak now" : value ? "Tap to try again" : "Tap the microphone and read the sentence"}
          </p>
          {rec.error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-rose-500">
              <MicOff className="h-4 w-4" /> {rec.error}
            </p>
          )}
          {(value || rec.transcript) && <div className="w-full"><SpeakingFeedback expected={d.text} heard={value ?? rec.transcript} /></div>}
          {rec.recordingUrl && (
            <div className="flex items-center gap-2 text-sm">
              <Play className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-muted">Your recording:</span>
              <audio controls src={rec.recordingUrl} className="h-9" />
            </div>
          )}
          {onSkip && !locked && (
            <button type="button" className="text-sm font-semibold text-muted underline" onClick={onSkip}>
              Can&apos;t speak right now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sentence builder ────────────────────────────────────────
function SentenceBuilder({ exercise, onChange, locked }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "sentence_builder" }>;
  const tiles = useShuffled(
    [...d.answer.split(" "), ...(d.extraWords ?? [])].map((w, i) => ({ id: i, w })),
    exercise.id,
  );
  const [picked, setPicked] = React.useState<number[]>([]);
  React.useEffect(() => setPicked([]), [exercise.id]);
  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.length ? next.map((id) => tiles.find((t) => t.id === id)!.w).join(" ") : null);
  };
  return (
    <div>
      {d.prompt && <p className="mb-4 font-display text-xl font-bold">{d.prompt}</p>}
      <div className="mb-6 flex min-h-16 flex-wrap items-center gap-2 border-b-2 border-border pb-3" aria-label="Your sentence" aria-live="polite">
        {picked.length === 0 && <span className="text-sm text-muted">Tap the words below to build the sentence</span>}
        {picked.map((id) => {
          const t = tiles.find((x) => x.id === id)!;
          return (
            <motion.button
              layout
              key={id}
              type="button"
              disabled={locked}
              onClick={() => update(picked.filter((p) => p !== id))}
              className="rounded-xl border-2 border-border bg-surface px-3 py-2 font-semibold shadow-[0_2px_0_var(--border)]"
              aria-label={`Remove ${t.w}`}
            >
              {t.w}
            </motion.button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {tiles.map((t) => {
          const used = picked.includes(t.id);
          return (
            <motion.button
              layout
              key={t.id}
              type="button"
              disabled={locked || used}
              onClick={() => update([...picked, t.id])}
              className={cn("rounded-xl border-2 px-3 py-2 font-semibold transition", used ? "border-dashed border-border bg-surface-2 text-transparent" : "border-border bg-surface shadow-[0_2px_0_var(--border)] hover:bg-surface-2")}
              aria-label={used ? `${t.w} (used)` : `Add ${t.w}`}
            >
              {t.w}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Translate / write ───────────────────────────────────────
function Translate({ exercise, value, onChange, locked }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "translate" }>;
  return (
    <div>
      {d.sourceLabel && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.sourceLabel}</p>}
      <p className="mb-6 mt-1 font-display text-2xl font-bold sm:text-3xl">{d.source}</p>
      <Textarea
        aria-label="Your answer"
        placeholder="Type your answer…"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={locked}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="text-lg"
        onKeyDown={(e) => {
          // Enter submits (handled by the player); Shift+Enter for new line.
          if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
        }}
      />
    </div>
  );
}

// ── Match pairs ─────────────────────────────────────────────
function MatchPairs({ exercise, onChange, locked }: ExerciseProps) {
  const d = exercise.data as Extract<Exercise["data"], { type: "match_pairs" }>;
  const lefts = useShuffled(d.pairs.map((p, i) => ({ i, t: p.left })), exercise.id + "L");
  const rights = useShuffled(d.pairs.map((p, i) => ({ i, t: p.right })), exercise.id + "R");
  const [selL, setSelL] = React.useState<number | null>(null);
  const [selR, setSelR] = React.useState<number | null>(null);
  const [matched, setMatched] = React.useState<number[]>([]);
  const [wrong, setWrong] = React.useState<[number, number] | null>(null);
  const attempts = React.useRef<[number, number][]>([]);

  React.useEffect(() => {
    setMatched([]);
    attempts.current = [];
  }, [exercise.id]);

  const tryPair = (l: number, r: number) => {
    attempts.current.push([l, r]);
    const ok = l === r || d.pairs[l].right === d.pairs[r].right;
    if (ok) {
      const next = [...matched, l];
      setMatched(next);
      if (next.length === d.pairs.length) onChange(JSON.stringify(attempts.current));
    } else {
      setWrong([l, r]);
      setTimeout(() => setWrong(null), 600);
    }
    setSelL(null);
    setSelR(null);
  };

  const cell = (side: "L" | "R", item: { i: number; t: string }) => {
    const isMatched = matched.includes(item.i);
    const selected = side === "L" ? selL === item.i : selR === item.i;
    const isWrong = wrong && (side === "L" ? wrong[0] === item.i : wrong[1] === item.i);
    return (
      <button
        key={side + item.i}
        type="button"
        disabled={locked || isMatched}
        aria-pressed={selected}
        onClick={() => {
          if (side === "L") {
            if (selR !== null) tryPair(item.i, selR);
            else setSelL(item.i);
          } else {
            if (selL !== null) tryPair(selL, item.i);
            else setSelR(item.i);
          }
        }}
        className={cn(
          "min-h-14 w-full rounded-2xl border-2 px-3 py-2 text-center font-semibold transition",
          isMatched && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 opacity-60 dark:text-emerald-300",
          !isMatched && selected && "border-primary bg-indigo-500/10 text-primary",
          !isMatched && !selected && "border-border bg-surface hover:bg-surface-2",
          isWrong && "animate-shake border-rose-500 bg-rose-500/10",
        )}
      >
        {item.t}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-3">{lefts.map((l) => cell("L", l))}</div>
      <div className="space-y-3">{rights.map((r) => cell("R", r))}</div>
      <p className="col-span-2 text-center text-xs text-muted" aria-live="polite">
        {matched.length}/{d.pairs.length} matched
      </p>
    </div>
  );
}

export function ExerciseView(props: ExerciseProps) {
  switch (props.exercise.data.type) {
    case "multiple_choice":
      return <MultipleChoice {...props} />;
    case "fill_blank":
      return <FillBlank {...props} />;
    case "listening":
      return <Listening {...props} />;
    case "speaking":
      return <Speaking {...props} />;
    case "sentence_builder":
      return <SentenceBuilder {...props} />;
    case "translate":
      return <Translate {...props} />;
    case "match_pairs":
      return <MatchPairs {...props} />;
  }
}
