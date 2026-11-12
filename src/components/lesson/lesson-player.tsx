"use client";
import { motion } from "framer-motion";
import { CheckCircle2, Flame, Lightbulb, Target, Trophy, X, XCircle, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLearner } from "@/components/providers/learner";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, ProgressBar } from "@/components/ui/misc";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { getLanguage } from "@/lib/languages";
import type { AnswerSubmission, Exercise, Lesson, LessonCompletionResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkAnswer } from "@/lib/validation";
import { Confetti } from "./celebration";
import { ExerciseView } from "./exercises";

interface Feedback {
  correct: boolean;
  typo?: boolean;
  expected: string;
  explanation: string;
  skipped?: boolean;
}

export interface LessonPlayerProps {
  lesson: Lesson;
  mode?: "lesson" | "review";
  nextLessonId?: string | null;
}

export function LessonPlayer({ lesson, mode = "lesson", nextLessonId }: LessonPlayerProps) {
  const router = useRouter();
  const { act, state } = useLearner();
  const locale = getLanguage(state?.profile.targetLang).speechLocale;
  const [started, setStarted] = React.useState(!lesson.tip);
  const [queue, setQueue] = React.useState<Exercise[]>(lesson.exercises);
  const [pos, setPos] = React.useState(0);
  const [value, setValue] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const firstAnswers = React.useRef(new Map<string, AnswerSubmission>());
  const retried = React.useRef(new Set<string>());
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LessonCompletionResult | null>(null);
  const [confirmExit, setConfirmExit] = React.useState(false);
  const startedAt = React.useRef(Date.now());

  const current = queue[pos];
  const total = lesson.exercises.length;

  const finish = React.useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const answers = lesson.exercises.map((e) => firstAnswers.current.get(e.id) ?? { exerciseId: e.id, answer: "", skipped: e.data.type === "speaking" || e.data.type === "listening" });
    try {
      const res =
        mode === "review"
          ? await act<LessonCompletionResult>({ type: "completeReview", exerciseIds: lesson.exercises.map((e) => e.id), answers })
          : await act<LessonCompletionResult>({ type: "completeLesson", lessonId: lesson.id, answers });
      setResult(res);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [act, lesson, mode]);

  const check = React.useCallback(() => {
    if (!current || value === null || feedback) return;
    const c = checkAnswer(current, value);
    if (!firstAnswers.current.has(current.id)) firstAnswers.current.set(current.id, { exerciseId: current.id, answer: value });
    setFeedback({ correct: c.correct, typo: c.typo, expected: c.expected, explanation: current.explanation });
    // Adaptive repetition: a missed exercise comes back once at the end of the lesson.
    if (!c.correct && !retried.current.has(current.id)) {
      retried.current.add(current.id);
      setQueue((q) => [...q, current]);
    }
  }, [current, value, feedback]);

  const skip = React.useCallback(() => {
    if (!current) return;
    if (!firstAnswers.current.has(current.id)) firstAnswers.current.set(current.id, { exerciseId: current.id, answer: "", skipped: true });
    setFeedback({ correct: true, skipped: true, expected: "", explanation: "Skipped – this won't affect your score." });
  }, [current]);

  const next = React.useCallback(() => {
    if (!feedback) return;
    setFeedback(null);
    setValue(null);
    if (pos + 1 >= queue.length) void finish();
    else setPos((p) => p + 1);
  }, [feedback, pos, queue.length, finish]);

  // Keyboard: Enter checks / continues.
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !started || result || saving) return;
      if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
      e.preventDefault();
      if (feedback) next();
      else check();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [feedback, next, check, started, result, saving]);

  const progress = queue.length ? Math.min(1, (feedback ? pos + 1 : pos) / queue.length) : 0;

  if (result) return <LessonSummary lesson={lesson} result={result} seconds={Math.round((Date.now() - startedAt.current) / 1000)} nextLessonId={mode === "lesson" ? nextLessonId : null} />;

  if (!started)
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Lesson</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">{lesson.title}</h1>
          <p className="mt-2 text-muted">{lesson.description}</p>
          <div className="mt-6 flex gap-3 rounded-2xl bg-amber-500/10 p-4">
            <Lightbulb className="h-6 w-6 shrink-0 text-amber-500" aria-hidden />
            <p className="text-sm leading-relaxed">{lesson.tip}</p>
          </div>
          <p className="mt-6 text-sm text-muted">
            {total} exercises · about {Math.max(2, Math.round(total * 0.6))} minutes
          </p>
          <div className="mt-6 flex gap-3">
            <Button size="lg" onClick={() => setStarted(true)} autoFocus>
              Start lesson
            </Button>
            <ButtonLink href="/learn" variant="ghost" size="lg">
              Back
            </ButtonLink>
          </div>
        </motion.div>
      </div>
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-6">
        <button onClick={() => setConfirmExit(true)} aria-label="Exit lesson" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
          <X className="h-6 w-6" />
        </button>
        <ProgressBar value={progress} color="bg-secondary" label="Lesson progress" />
        <span className="text-sm font-bold text-muted" aria-label={`Exercise ${Math.min(pos + 1, queue.length)} of ${queue.length}`}>
          {Math.min(pos + 1, queue.length)}/{queue.length}
        </span>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {saveError ? (
          <ErrorState message={`Your answers couldn't be saved: ${saveError}`} onRetry={finish} />
        ) : current ? (
            <motion.div key={`${current.id}-${pos}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
              {pos >= total && <p className="mb-2 text-sm font-semibold text-amber-600 dark:text-amber-400">Let&apos;s try this one again</p>}
              <h1 className="mb-6 text-lg font-bold text-muted">{current.instruction}</h1>
              <ExerciseView
                exercise={current}
                value={value}
                onChange={setValue}
                locked={!!feedback}
                locale={locale}
                onSkip={current.data.type === "speaking" || current.data.type === "listening" ? skip : undefined}
              />
            </motion.div>
        ) : null}
      </main>

      {/* Bottom action / feedback bar */}
      <footer
        className={cn(
          "sticky bottom-0 border-t-2 transition-colors",
          !feedback && "border-border bg-bg",
          feedback?.correct && "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/60",
          feedback && !feedback.correct && "border-rose-500/30 bg-rose-50 dark:bg-rose-950/50",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="assertive" className="min-h-6">
            {feedback && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                {feedback.correct ? <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden /> : <XCircle className="h-8 w-8 shrink-0 text-rose-500" aria-hidden />}
                <div>
                  <p className={cn("font-display text-lg font-extrabold", feedback.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                    {feedback.skipped ? "Skipped" : feedback.correct ? (feedback.typo ? "Correct – watch the spelling!" : "Great job!") : "Not quite"}
                  </p>
                  {!feedback.correct && feedback.expected && (
                    <p className="text-sm">
                      Correct answer: <strong>{feedback.expected}</strong>
                    </p>
                  )}
                  {feedback.typo && (
                    <p className="text-sm">
                      Expected spelling: <strong>{feedback.expected}</strong>
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-muted">{feedback.explanation}</p>
                </div>
              </motion.div>
            )}
          </div>
          {saving ? (
            <Button size="lg" loading className="sm:min-w-40">
              Saving
            </Button>
          ) : feedback ? (
            <Button size="lg" variant={feedback.correct ? "secondary" : "danger"} onClick={next} className="sm:min-w-40" autoFocus>
              Continue
            </Button>
          ) : (
            <Button size="lg" onClick={check} disabled={value === null || !!saveError} className="sm:min-w-40">
              Check
            </Button>
          )}
        </div>
      </footer>

      {confirmExit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="exit-title">
          <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-xl">
            <div className="text-4xl">😢</div>
            <h2 id="exit-title" className="mt-2 font-display text-xl font-bold">
              Leave this lesson?
            </h2>
            <p className="mt-1 text-sm text-muted">Your progress in this lesson will be lost.</p>
            <div className="mt-5 grid gap-2">
              <Button onClick={() => setConfirmExit(false)} autoFocus>
                Keep learning
              </Button>
              <Button variant="ghost" onClick={() => router.push(mode === "review" ? "/flashcards" : "/learn")}>
                Quit lesson
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonSummary({ lesson, result, seconds, nextLessonId }: { lesson: Lesson; result: LessonCompletionResult; seconds: number; nextLessonId?: string | null }) {
  const great = result.score >= 80;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      {great && <Confetti />}
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} className="text-7xl">
        {result.perfect ? "🏆" : great ? "🎉" : "💪"}
      </motion.div>
      <h1 className="mt-4 font-display text-3xl font-extrabold">{result.perfect ? "Perfect lesson!" : great ? "Lesson complete!" : "Good effort!"}</h1>
      <p className="mt-1 text-muted">{lesson.title}</p>

      <div className="mt-8 grid w-full grid-cols-3 gap-3">
        {[
          { icon: <Zap className="h-5 w-5" />, label: "XP earned", value: `+${result.xpEarned}`, color: "text-amber-500 border-amber-500/40" },
          { icon: <Target className="h-5 w-5" />, label: "Accuracy", value: `${result.score}%`, color: "text-emerald-500 border-emerald-500/40" },
          { icon: <Flame className="h-5 w-5" />, label: "Streak", value: `${result.streak} day${result.streak === 1 ? "" : "s"}`, color: "text-orange-500 border-orange-500/40" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className={cn("rounded-2xl border-2 bg-surface p-4", s.color)}>
            <div className="flex justify-center">{s.icon}</div>
            <p className="mt-1 font-display text-xl font-extrabold text-fg">{s.value}</p>
            <p className="text-xs font-semibold text-muted">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 w-full space-y-2 text-sm">
        <p>
          {result.correct} of {result.total} answered correctly on the first try
          {seconds > 0 && ` · ${Math.floor(seconds / 60)}m ${seconds % 60}s`}
        </p>
        {result.newWords > 0 && <p className="font-semibold text-primary">📚 {result.newWords} new words added to your flashcards</p>}
        {result.streakExtended && <p className="font-semibold text-orange-500">🔥 Streak extended to {result.streak} day{result.streak === 1 ? "" : "s"}!</p>}
        {!result.firstCompletion && result.lessonId !== "review" && <p className="text-muted">Practice round – repeat lessons earn half XP.</p>}
        {result.unlockedAchievements.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          return a ? (
            <p key={id} className="flex items-center justify-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
              <Trophy className="h-4 w-4" /> Achievement unlocked: {a.icon} {a.title}
            </p>
          ) : null;
        })}
        {result.score < 60 && <p className="text-muted">Tip: retry this lesson later – the app will remind you to review missed words.</p>}
      </div>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {nextLessonId ? (
          <ButtonLink href={`/lesson/${nextLessonId}`} size="lg" block>
            Next lesson
          </ButtonLink>
        ) : (
          <ButtonLink href="/flashcards" size="lg" block>
            Review flashcards
          </ButtonLink>
        )}
        <ButtonLink href="/dashboard" size="lg" variant="outline" block>
          Back to home
        </ButtonLink>
      </div>
      <Link href="/learn" className="mt-4 text-sm font-semibold text-muted hover:text-fg">
        View learning path
      </Link>
    </div>
  );
}
