import type { UserWord } from "./types";

/** Review grades shown on flashcards. */
export type Grade = "again" | "hard" | "good" | "easy";

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function newUserWord(wordId: string, now: Date, opts: Partial<UserWord> = {}): UserWord {
  return {
    wordId,
    saved: false,
    learned: false,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: now.toISOString(),
    lastReviewed: null,
    correct: 0,
    incorrect: 0,
    ...opts,
  };
}

/**
 * Simplified SM-2 spaced-repetition scheduler.
 * - "again" resets the card to be seen again in 10 minutes and counts a lapse.
 * - otherwise the interval grows by the ease factor; ease adapts to answer quality.
 */
export function schedule(card: UserWord, grade: Grade, now: Date): UserWord {
  const q = QUALITY[grade];
  let { ease, interval, reps, lapses } = card;
  let dueMs: number;

  if (q < 3) {
    reps = 0;
    lapses += 1;
    interval = 0;
    dueMs = now.getTime() + 10 * 60_000;
  } else {
    reps += 1;
    if (reps === 1) interval = grade === "easy" ? 3 : 1;
    else if (reps === 2) interval = grade === "hard" ? 3 : 6;
    else interval = Math.round(interval * (grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease));
    interval = Math.max(1, interval);
    dueMs = now.getTime() + interval * 86_400_000;
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  return {
    ...card,
    ease: Math.round(ease * 100) / 100,
    interval,
    reps,
    lapses,
    learned: true,
    due: new Date(dueMs).toISOString(),
    lastReviewed: now.toISOString(),
    correct: card.correct + (q >= 3 ? 1 : 0),
    incorrect: card.incorrect + (q < 3 ? 1 : 0),
  };
}

/** Called when a word is answered inside a lesson exercise. Mistakes make the card due immediately. */
export function practiceInLesson(card: UserWord, correct: boolean, now: Date): UserWord {
  if (correct) return { ...card, correct: card.correct + 1 };
  return {
    ...card,
    incorrect: card.incorrect + 1,
    ease: Math.max(1.3, Math.round((card.ease - 0.15) * 100) / 100),
    due: now.toISOString(),
  };
}

export type ReviewStatus = "new" | "learning" | "reviewing" | "mastered";

export function reviewStatus(card: UserWord | undefined): ReviewStatus {
  if (!card || card.reps === 0) return card?.learned ? "learning" : "new";
  if (card.interval >= 21) return "mastered";
  if (card.reps >= 2) return "reviewing";
  return "learning";
}

export function isDue(card: UserWord, now: Date): boolean {
  return card.learned && new Date(card.due).getTime() <= now.getTime();
}

/** A word is "weak" when the learner keeps missing it. */
export function isWeak(card: UserWord): boolean {
  const total = card.correct + card.incorrect;
  return card.lapses >= 2 || (total >= 2 && card.incorrect / total >= 0.4);
}
