/**
 * Transparent, rule-based personalisation. Every recommendation returns a human-readable
 * `reason`, shown in the UI, so learners can see why the app suggests something.
 */
import { isDue, isWeak } from "./srs";
import type { Course, Exercise, LearnerState, Lesson, LessonSummary, VocabWord } from "./types";

export interface LessonNode extends LessonSummary {
  unitOrder: number;
  unitTitle: string;
  state: "locked" | "available" | "completed";
  bestScore?: number;
}

/** Flatten the course and decide which lessons are unlocked. */
export function lessonNodes(course: Course, state: LearnerState | null): LessonNode[] {
  const nodes: LessonNode[] = [];
  let prevDone = true;
  const placementUnit = state?.profile.placementUnit ?? 1;
  for (const unit of course.units.filter((u) => u.published).sort((a, b) => a.order - b.order)) {
    const lessons = unit.lessons.filter((x) => x.published).sort((a, b) => a.order - b.order);
    lessons.forEach((l, li) => {
      const progress = state?.lessonProgress[l.id];
      // Placement test: units before the placement unit are open; the placement unit's first lesson is open.
      const skipped = unit.order < placementUnit;
      const startHere = unit.order === placementUnit && li === 0;
      const st: LessonNode["state"] = progress ? "completed" : prevDone || skipped || startHere ? "available" : "locked";
      nodes.push({ ...l, unitOrder: unit.order, unitTitle: unit.title, state: st, bestScore: progress?.bestScore });
      prevDone = !!progress;
    });
  }
  return nodes;
}

export interface Recommendation {
  kind: "lesson" | "review" | "redo" | "done";
  lessonId?: string;
  title: string;
  reason: string;
}

export function dueWords(state: LearnerState, now = new Date()) {
  return Object.values(state.vocab).filter((c) => isDue(c, now));
}

export function weakWords(state: LearnerState) {
  return Object.values(state.vocab).filter((c) => c.learned && isWeak(c));
}

export function recommendNext(course: Course | null, state: LearnerState, now = new Date()): Recommendation {
  const due = dueWords(state, now);
  const weak = weakWords(state);
  if (weak.length >= 5)
    return { kind: "review", title: "Practice weak words", reason: `You have missed ${weak.length} words several times. A short review will lock them in.` };
  if (due.length >= 15)
    return { kind: "review", title: "Review due words", reason: `${due.length} words are due for spaced-repetition review.` };
  if (!course) return { kind: "done", title: "Explore the AI tutor", reason: "No course is published for your target language yet." };
  const nodes = lessonNodes(course, state);
  const struggling = nodes.find((n) => n.state === "completed" && (n.bestScore ?? 100) < 60);
  if (struggling)
    return { kind: "redo", lessonId: struggling.id, title: `Retry: ${struggling.title}`, reason: `Your best score here is ${struggling.bestScore}%. Retrying lessons under 60% strengthens the basics.` };
  const next = nodes.find((n) => n.state === "available");
  if (next) return { kind: "lesson", lessonId: next.id, title: next.title, reason: `Next lesson in “${next.unitTitle}”.` };
  if (due.length) return { kind: "review", title: "Review due words", reason: `You finished the course – keep ${due.length} words fresh with a review.` };
  return { kind: "done", title: "Course complete!", reason: "You've completed every lesson. Practise with the AI tutor or speaking drills." };
}

export interface PlanItem {
  id: string;
  title: string;
  minutes: number;
  href: string;
  reason: string;
}

/** A daily plan sized to the learner's chosen minutes per day. */
export function dailyPlan(course: Course | null, state: LearnerState, now = new Date()): PlanItem[] {
  const budget = state.profile.dailyMinutes;
  const items: PlanItem[] = [];
  const due = dueWords(state, now).length;
  if (due > 0) items.push({ id: "review", title: `Review ${Math.min(due, 20)} flashcards`, minutes: Math.min(5, Math.ceil(due / 4)), href: "/flashcards", reason: "Spaced repetition: these words are due today." });
  const rec = recommendNext(course, state, now);
  if (rec.lessonId) items.push({ id: "lesson", title: rec.title, minutes: 5, href: `/lesson/${rec.lessonId}`, reason: rec.reason });
  if (course) {
    const nodes = lessonNodes(course, state).filter((n) => n.state === "available" && n.id !== rec.lessonId);
    let used = items.reduce((n, i) => n + i.minutes, 0);
    for (const n of nodes) {
      if (used + 5 > budget - 3) break;
      items.push({ id: `lesson-${n.id}`, title: n.title, minutes: 5, href: `/lesson/${n.id}`, reason: "Keeps you moving along your path." });
      used += 5;
      if (items.length >= 4) break;
    }
  }
  const used = items.reduce((n, i) => n + i.minutes, 0);
  if (budget - used >= 3) items.push({ id: "speaking", title: "Speaking drill", minutes: 3, href: "/speaking", reason: "Daily speaking builds confidence." });
  if (budget - used >= 8) items.push({ id: "tutor", title: "Chat with the AI tutor", minutes: 5, href: "/tutor", reason: "Use new words in a real conversation." });
  return items;
}

/** Most-missed exercise types, for analytics and focus suggestions. */
export function mistakeBreakdown(state: LearnerState) {
  const by = new Map<string, { type: string; wrong: number; total: number }>();
  for (const a of state.recentAttempts) {
    const e = by.get(a.type) ?? { type: a.type, wrong: 0, total: 0 };
    e.total++;
    if (!a.correct) e.wrong++;
    by.set(a.type, e);
  }
  return [...by.values()].map((e) => ({ ...e, accuracy: e.total ? Math.round(((e.total - e.wrong) / e.total) * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy);
}

// ── Generated review lessons ────────────────────────────────

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build one review exercise from its id: `review~<wordId>~<kind>`.
 * Deterministic so the server can rebuild & validate the exact same exercise.
 */
export function buildReviewExercise(exerciseId: string, allWords: VocabWord[]): Exercise | null {
  const [, wordId, kind] = exerciseId.split("~");
  const word = allWords.find((x) => x.id === wordId);
  if (!word) return null;
  const rand = seeded(exerciseId);
  const pool = [...allWords].sort((a, b) => a.id.localeCompare(b.id)).filter((x) => x.id !== word.id && x.courseId === word.courseId);
  const distractors = shuffle(pool, rand).slice(0, 3);
  const base = { id: exerciseId, lessonId: "review", order: 0, wordIds: [word.id] };
  if (kind === "meaning") {
    const choices = shuffle([word, ...distractors], rand);
    return { ...base, instruction: "What does this word mean?", explanation: `“${word.term}” means: ${word.meaning}.`, data: { type: "multiple_choice", question: word.term, image: word.emoji, choices: choices.map((c) => c.meaning), answer: choices.findIndex((c) => c.id === word.id), speak: word.term } };
  }
  if (kind === "term") {
    const choices = shuffle([word, ...distractors], rand);
    return { ...base, instruction: "Which word matches the meaning?", explanation: `${word.meaning} → “${word.term}”.`, data: { type: "multiple_choice", question: word.meaning, image: word.emoji, choices: choices.map((c) => c.term), answer: choices.findIndex((c) => c.id === word.id) } };
  }
  if (kind === "listen") {
    return { ...base, instruction: "Listen and type the word", explanation: `You heard “${word.term}”.`, data: { type: "listening", mode: "type", audioText: word.term, accepted: [word.term] } };
  }
  return null;
}

export function buildReviewLesson(wordIds: string[], allWords: VocabWord[], seed = Date.now().toString(36)): Lesson {
  const kinds = ["meaning", "term", "listen"];
  const exercises: Exercise[] = [];
  wordIds.slice(0, 10).forEach((id, i) => {
    const ex = buildReviewExercise(`review~${id}~${kinds[(i + seed.length) % kinds.length]}~${seed}`, allWords);
    if (ex) exercises.push({ ...ex, order: i + 1 });
  });
  return {
    id: `review-${seed}`,
    unitId: "review",
    order: 0,
    title: "Personal review",
    description: "Words you find hard and words due for review",
    xpReward: exercises.length * 2,
    published: true,
    exerciseCount: exercises.length,
    exercises,
  };
}

/** Choose which words to review: weakest first, then most overdue. */
export function pickReviewWords(state: LearnerState, now = new Date(), limit = 10): string[] {
  const learned = Object.values(state.vocab).filter((c) => c.learned);
  const weak = learned.filter(isWeak).sort((a, b) => b.incorrect - a.incorrect);
  const due = learned.filter((c) => isDue(c, now) && !isWeak(c)).sort((a, b) => a.due.localeCompare(b.due));
  return [...weak, ...due].slice(0, limit).map((c) => c.wordId);
}
