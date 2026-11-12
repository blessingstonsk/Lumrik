"use client";
import { motion } from "framer-motion";
import { Brain, RotateCcw } from "lucide-react";
import * as React from "react";
import { SpeakButton } from "@/components/lesson/exercises";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, PageSkeleton, ProgressBar, Tabs } from "@/components/ui/misc";
import { weakWords } from "@/lib/adaptive";
import { getLanguage } from "@/lib/languages";
import { isDue, type Grade } from "@/lib/srs";
import type { VocabWord } from "@/lib/types";

type Deck = "due" | "saved" | "all";
const GRADES: { g: Grade; label: string; hint: string; cls: string }[] = [
  { g: "again", label: "Again", hint: "Forgot", cls: "danger" },
  { g: "hard", label: "Hard", hint: "Struggled", cls: "outline" },
  { g: "good", label: "Good", hint: "Remembered", cls: "secondary" },
  { g: "easy", label: "Easy", hint: "Instant", cls: "primary" },
];

export default function FlashcardsPage() {
  const state = useLearnerState();
  const { vocabulary, courseLoading, act } = useLearner();
  const toast = useToast();
  const [deck, setDeck] = React.useState<Deck>("due");
  const [queue, setQueue] = React.useState<VocabWord[] | null>(null);
  const [flipped, setFlipped] = React.useState(false);
  const [reviewed, setReviewed] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const locale = getLanguage(state.profile.targetLang).speechLocale;

  const build = React.useCallback(
    (d: Deck) => {
      const now = new Date();
      const byId = new Map(vocabulary.map((v) => [v.id, v]));
      const cards = Object.values(state.vocab).filter((c) => byId.has(c.wordId) && (d === "saved" ? c.saved : c.learned) && (d !== "due" || isDue(c, now)));
      cards.sort((a, b) => a.due.localeCompare(b.due));
      return cards.slice(0, 30).map((c) => byId.get(c.wordId)!);
    },
    // Build a fresh session only when the deck changes, not after each review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocabulary],
  );

  React.useEffect(() => {
    if (!courseLoading) {
      setQueue(build(deck));
      setReviewed(0);
      setFlipped(false);
    }
  }, [deck, courseLoading, build]);

  const card = queue?.[0];

  const grade = React.useCallback(
    async (g: Grade) => {
      if (!card || busy) return;
      setBusy(true);
      try {
        await act({ type: "reviewCard", wordId: card.id, grade: g });
        setReviewed((n) => n + 1);
        setFlipped(false);
        // "Again" puts the card back at the end of this session.
        setQueue((q) => (q ? (g === "again" ? [...q.slice(1), q[0]] : q.slice(1)) : q));
      } catch (e) {
        toast({ title: "Couldn't save review", description: (e as Error).message, tone: "error" });
      } finally {
        setBusy(false);
      }
    },
    [card, busy, act, toast],
  );

  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) void grade(GRADES[Number(e.key) - 1].g);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [card, flipped, grade]);

  if (courseLoading || !queue) return <PageSkeleton />;
  const weak = weakWords(state).length;
  const total = reviewed + queue.length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Flashcards"
        subtitle="Spaced repetition: rate how well you remembered and we'll schedule the next review."
        action={
          weak > 0 ? (
            <ButtonLink href="/lesson/review" variant="outline" size="sm">
              <Brain className="h-4 w-4" /> Practise {weak} weak words
            </ButtonLink>
          ) : undefined
        }
      />
      <Tabs
        label="Deck"
        value={deck}
        onChange={setDeck}
        tabs={[
          { id: "due", label: "Due now" },
          { id: "saved", label: "Bookmarked" },
          { id: "all", label: "All learned" },
        ]}
      />

      <div className="mt-6">
        {card ? (
          <>
            <ProgressBar value={total ? reviewed / total : 0} color="bg-secondary" className="mb-4 h-2" label="Session progress" />
              <motion.div key={card.id + reviewed} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}>
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  aria-label={flipped ? "Hide answer" : "Show answer"}
                  className="block w-full [perspective:1200px]"
                >
                  <motion.div
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.45 }}
                    className="relative h-72 w-full [transform-style:preserve-3d]"
                  >
                    <Card className="absolute inset-0 flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
                      {card.emoji && <span className="text-6xl" aria-hidden>{card.emoji}</span>}
                      <span className="font-display text-4xl font-extrabold">{card.term}</span>
                      <span className="text-sm text-muted">Tap or press Space to reveal</span>
                    </Card>
                    <Card className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <span className="font-display text-2xl font-extrabold">{card.term}</span>
                      <span className="font-mono text-sm text-muted">{card.pronunciation}</span>
                      <Badge>{card.partOfSpeech}</Badge>
                      <span className="mt-2 text-lg font-semibold">{card.meaning}</span>
                      <span className="text-sm italic text-muted">&ldquo;{card.example}&rdquo;</span>
                    </Card>
                  </motion.div>
                </button>
              </motion.div>
            <div className="mt-4 flex justify-center">
              <SpeakButton text={card.term} locale={locale} audioUrl={card.audioUrl} label={`Hear ${card.term}`} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRADES.map((g, i) => (
                <Button key={g.g} variant={g.cls as "primary"} disabled={!flipped || busy} onClick={() => grade(g.g)} className="h-auto flex-col py-3">
                  <span>{g.label}</span>
                  <span className="text-xs font-normal opacity-80">
                    {i + 1} · {g.hint}
                  </span>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted">{flipped ? "Keys 1–4 rate the card" : "Reveal the answer to rate it"}</p>
          </>
        ) : reviewed > 0 ? (
          <EmptyState
            icon="🎉"
            title={`Session complete – ${reviewed} reviews`}
            description="Great work. Cards will come back right before you're likely to forget them."
            action={
              <Button variant="outline" onClick={() => setQueue(build(deck))}>
                <RotateCcw className="h-4 w-4" /> Check for more
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={deck === "saved" ? "🔖" : "✨"}
            title={deck === "due" ? "No cards due right now" : deck === "saved" ? "No bookmarked words yet" : "No words learned yet"}
            description={
              deck === "due"
                ? "You're all caught up! Learn new words in a lesson, or review all your words."
                : deck === "saved"
                  ? "Bookmark words in your vocabulary notebook to practise them here."
                  : "Complete a lesson – every word you practise becomes a flashcard."
            }
            action={<ButtonLink href={deck === "saved" ? "/vocabulary" : "/learn"}>{deck === "saved" ? "Open vocabulary" : "Go to lessons"}</ButtonLink>}
          />
        )}
      </div>
    </div>
  );
}
