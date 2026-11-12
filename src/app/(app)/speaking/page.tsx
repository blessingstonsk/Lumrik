"use client";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Mic, Repeat, Shuffle, Square } from "lucide-react";
import * as React from "react";
import { SpeakButton, SpeakingFeedback } from "@/components/lesson/exercises";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Badge, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { contentRepo } from "@/lib/data/content";
import { fontClassFor, getLanguage } from "@/lib/languages";
import { useRecognizer } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { transcriptScore } from "@/lib/validation";

type Mode = "sentences" | "words" | "custom";

export default function SpeakingPage() {
  const state = useLearnerState();
  const { course, vocabulary, courseLoading, act } = useLearner();
  const toast = useToast();
  const target = state.profile.targetLang;
  const lang = getLanguage(target);
  const rec = useRecognizer(lang.speechLocale);
  const [mode, setMode] = React.useState<Mode>("sentences");
  const [sentences, setSentences] = React.useState<string[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [custom, setCustom] = React.useState("");
  const [heard, setHeard] = React.useState<string | null>(null);
  const [best, setBest] = React.useState<Record<string, number>>({});

  // Sentences come from the speaking exercises + example sentences of lessons the learner has completed.
  React.useEffect(() => {
    if (!course) return;
    const unlocked = course.units.flatMap((u) => u.lessons).filter((l) => state.lessonProgress[l.id]);
    const ids = (unlocked.length ? unlocked : course.units.flatMap((u) => u.lessons).slice(0, 2)).map((l) => l.id);
    Promise.all(ids.map((id) => contentRepo.getLesson(id))).then((lessons) => {
      const s = lessons.flatMap((l) => l?.exercises.filter((e) => e.data.type === "speaking").map((e) => (e.data as { text: string }).text) ?? []);
      setSentences([...new Set(s)]);
    });
    // Only rebuild when the set of completed lessons changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, Object.keys(state.lessonProgress).length]);

  const learnedWords = vocabulary.filter((v) => state.vocab[v.id]?.learned);
  const items = mode === "sentences" ? sentences : mode === "words" ? (learnedWords.length ? learnedWords : vocabulary.slice(0, 12)).map((w) => w.term) : custom.trim() ? [custom.trim()] : [];
  const current = items[idx % Math.max(1, items.length)] ?? "";

  React.useEffect(() => {
    setIdx(0);
    setHeard(null);
  }, [mode]);

  const go = (d: number) => {
    setHeard(null);
    setIdx((i) => (i + d + items.length) % Math.max(1, items.length));
  };

  const record = async () => {
    setHeard(null);
    const t = await rec.start();
    if (!t) return;
    setHeard(t);
    const score = transcriptScore(current, t).score;
    setBest((b) => ({ ...b, [current]: Math.max(b[current] ?? 0, score) }));
    try {
      const r = await act<{ xpEarned: number }>({ type: "practice", kind: "speaking" });
      if (score >= 0.8 && r.xpEarned) toast({ title: `+${r.xpEarned} XP`, description: "Nice pronunciation practice!", icon: "🎙️", tone: "success" });
    } catch {
      /* XP is a bonus – ignore failures */
    }
  };

  if (courseLoading) return <PageSkeleton />;
  const mastered = Object.values(best).filter((s) => s >= 0.8).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Speaking practice" subtitle={`Listen, repeat and see which words the recogniser understood. ${mastered ? `${mastered} nailed this session.` : ""}`} />
      <Tabs
        label="Practice mode"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: "sentences", label: "Sentence repetition" },
          { id: "words", label: "Word drill" },
          { id: "custom", label: "Your own text" },
        ]}
      />

      {!rec.supported && (
        <div className="mt-6 rounded-2xl bg-amber-500/10 p-4 text-sm" role="status">
          <p className="font-semibold">Speech recognition isn&apos;t supported in this browser.</p>
          <p className="mt-1 text-muted">Use Chrome, Edge or Safari for speaking feedback. You can still listen to native-style audio examples below and repeat them aloud.</p>
        </div>
      )}

      {mode === "custom" && (
        <Card className="mt-6">
          <label htmlFor="custom" className="mb-1.5 block text-sm font-bold">
            Type a sentence in {lang.name} to practise
          </label>
          <Input id="custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} className={fontClassFor(target)} lang={target} placeholder="e.g. Nice to meet you" />
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="mt-6 text-center text-sm text-muted">{mode === "custom" ? "Type something above to start practising." : "Complete a lesson to unlock sentences for speaking practice."}</Card>
      ) : (
        <Card className="mt-6">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {(idx % items.length) + 1} / {items.length}
            </span>
            {best[current] !== undefined && <Badge tone={best[current] >= 0.8 ? "success" : "warning"}>Best: {Math.round(best[current] * 100)}%</Badge>}
          </div>
          <div className="my-6 flex flex-col items-center gap-4 text-center">
            <p className={cn("font-display text-2xl font-extrabold sm:text-3xl", fontClassFor(target))} lang={target}>
              {current}
            </p>
            <div className="flex items-center gap-3">
              <SpeakButton text={current} locale={lang.speechLocale} label="Listen" />
              <Button variant="ghost" size="sm" onClick={() => void import("@/lib/speech").then((m) => m.speak(current, { locale: lang.speechLocale, rate: 0.6 }))}>
                <Repeat className="h-4 w-4" /> Slow
              </Button>
            </div>
          </div>

          {rec.supported && (
            <div className="flex flex-col items-center gap-3">
              <motion.button
                type="button"
                onClick={rec.status === "listening" ? rec.stop : record}
                aria-label={rec.status === "listening" ? "Stop recording" : "Record yourself"}
                className={cn("flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg", rec.status === "listening" ? "bg-rose-500" : "bg-secondary")}
                animate={rec.status === "listening" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={rec.status === "listening" ? { repeat: Infinity, duration: 1.2 } : {}}
              >
                {rec.status === "listening" ? <Square className="h-9 w-9" /> : <Mic className="h-10 w-10" />}
              </motion.button>
              <p className="text-sm text-muted" aria-live="polite">
                {rec.status === "listening" ? `Listening… ${rec.transcript}` : "Tap and repeat the sentence"}
              </p>
              {rec.error && (
                <p role="alert" className="text-sm text-rose-500">
                  {rec.error}
                </p>
              )}
            </div>
          )}

          {heard !== null && (
            <div className="mt-6 space-y-3">
              <SpeakingFeedback expected={current} heard={heard} />
              {rec.recordingUrl && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm">
                  <span className="font-semibold">Compare:</span>
                  <span className="text-muted">You</span>
                  <audio controls src={rec.recordingUrl} className="h-9" />
                  <span className="text-muted">Example</span>
                  <SpeakButton text={current} locale={lang.speechLocale} label="Play example" />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => go(-1)} aria-label="Previous">
              <ChevronLeft className="h-5 w-5" /> Prev
            </Button>
            <Button variant="ghost" onClick={() => go(Math.floor(Math.random() * items.length))} aria-label="Random item">
              <Shuffle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={() => go(1)} aria-label="Next">
              Next <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      )}
      <p className="mt-4 text-center text-xs text-muted">
        How feedback works: your speech is transcribed by the browser&apos;s speech recogniser and compared word by word. It tells you whether you were understood – it does not measure accent or individual sounds.
      </p>
    </div>
  );
}
