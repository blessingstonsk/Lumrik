/**
 * The learning engine: pure functions that turn (current state + learner action) into
 * a result and a set of `Writes`. The exact same code runs:
 *   - in the browser (local mode), where writes are applied to localStorage, and
 *   - in API routes (Supabase mode), where writes are persisted to Postgres
 *     after the server has re-validated answers against database content.
 */
import { dayKey } from "./dates";
import { XP, computeStats, computeStreak, emptyActivity, missionsComplete, newlyUnlocked } from "./gamification";
import { newUserWord, practiceInLesson, schedule, type Grade } from "./srs";
import type {
  AnswerSubmission,
  DailyActivity,
  ExerciseAttempt,
  LearnerState,
  Lesson,
  LessonCompletionResult,
  PlacementQuestion,
  Profile,
  UserWord,
  Writes,
  XpTransaction,
} from "./types";
import { checkAnswer } from "./validation";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function today(state: LearnerState, now: Date) {
  return dayKey(now, state.profile.timezone);
}

function activityFor(state: LearnerState, day: string): DailyActivity {
  return { ...(state.activity[day] ?? emptyActivity(day)) };
}

function xpTx(amount: number, reason: XpTransaction["reason"], refId: string | null, day: string, now: Date): XpTransaction {
  return { id: uid(), amount, reason, refId, day, createdAt: now.toISOString() };
}

/** Recompute achievements after a set of writes, adding unlocks to the writes. */
function withAchievements(state: LearnerState, writes: Writes, now: Date): { writes: Writes; unlocked: string[] } {
  const next = applyWrites(state, writes);
  const unlocked = newlyUnlocked(next, computeStats(next, now));
  if (unlocked.length) {
    writes.achievements = [...(writes.achievements ?? []), ...unlocked.map((id) => ({ id, unlockedAt: now.toISOString() }))];
  }
  return { writes, unlocked };
}

// ── Lessons ─────────────────────────────────────────────────

export function completeLesson(
  state: LearnerState,
  lesson: Lesson,
  submissions: AnswerSubmission[],
  now = new Date(),
  opts: { isReview?: boolean } = {},
): { result: LessonCompletionResult; writes: Writes } {
  const day = today(state, now);
  const byId = new Map(submissions.map((s) => [s.exerciseId, s]));
  const attempts: ExerciseAttempt[] = [];
  const vocab = new Map<string, UserWord>();
  const getCard = (id: string) => vocab.get(id) ?? state.vocab[id] ?? newUserWord(id, now);

  let correct = 0;
  let total = 0;
  for (const ex of lesson.exercises) {
    const sub = byId.get(ex.id);
    if (!sub) throw new Error(`Missing answer for exercise ${ex.id}`);
    if (sub.skipped) {
      if (ex.data.type !== "speaking" && ex.data.type !== "listening") throw new Error("Only audio exercises can be skipped");
      continue;
    }
    total++;
    const check = checkAnswer(ex, sub.answer);
    if (check.correct) correct++;
    attempts.push({
      id: uid(),
      exerciseId: ex.id,
      lessonId: lesson.id,
      type: ex.data.type,
      correct: check.correct,
      answer: sub.answer.slice(0, 500),
      createdAt: now.toISOString(),
    });
    for (const w of ex.wordIds) vocab.set(w, practiceInLesson(getCard(w), check.correct, now));
  }

  const score = total === 0 ? 100 : Math.round((correct / total) * 100);
  const perfect = total > 0 && correct === total;
  const prev = state.lessonProgress[lesson.id];
  const firstCompletion = !opts.isReview && !prev;

  // Every word practised in the lesson becomes a learned flashcard.
  let newWords = 0;
  for (const [id, card] of vocab) {
    if (!card.learned) {
      newWords++;
      vocab.set(id, { ...card, learned: true, due: now.toISOString() });
    }
  }

  const xp: XpTransaction[] = [];
  const earned = XP.lessonBase + correct * XP.lessonPerCorrect;
  if (opts.isReview) xp.push(xpTx(correct * XP.lessonPerCorrect, "review", lesson.id, day, now));
  else if (firstCompletion) xp.push(xpTx(earned, "lesson", lesson.id, day, now));
  else xp.push(xpTx(Math.max(1, Math.round(earned * XP.repeatMultiplier)), "lesson_repeat", lesson.id, day, now));
  if (perfect && !opts.isReview && (!prev || prev.bestScore < 100)) xp.push(xpTx(XP.perfectBonus, "perfect_bonus", lesson.id, day, now));
  const xpEarned = xp.reduce((n, t) => n + t.amount, 0);

  const act = activityFor(state, day);
  act.xp += xpEarned;
  act.lessons += 1;

  const writes: Writes = {
    attempts,
    xp,
    activity: [act],
    vocab: [...vocab.values()],
  };
  if (!opts.isReview) {
    writes.lessonProgress = [
      {
        lessonId: lesson.id,
        status: "completed",
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        attempts: (prev?.attempts ?? 0) + 1,
        firstCompletedAt: prev?.firstCompletedAt ?? now.toISOString(),
        lastCompletedAt: now.toISOString(),
      },
    ];
  }

  const before = computeStreak(state.activity, day);
  const { unlocked } = withAchievements(state, writes, now);
  const after = computeStreak(applyWrites(state, writes).activity, day);

  return {
    writes,
    result: {
      lessonId: lesson.id,
      correct,
      total,
      score,
      xpEarned,
      perfect,
      firstCompletion,
      newWords,
      streak: after.current,
      streakExtended: !before.activeToday && after.activeToday,
      unlockedAchievements: unlocked,
    },
  };
}

// ── Flashcards ──────────────────────────────────────────────

export function reviewCard(state: LearnerState, wordId: string, grade: Grade, now = new Date()) {
  const day = today(state, now);
  const card = state.vocab[wordId] ?? newUserWord(wordId, now, { learned: true });
  const next = schedule(card, grade, now);
  const act = activityFor(state, day);
  const award = act.reviews < XP.reviewDailyCap ? XP.review : 0;
  act.reviews += 1;
  act.xp += award;
  const writes: Writes = { vocab: [next], activity: [act], xp: award ? [xpTx(award, "review", wordId, day, now)] : [] };
  const { unlocked } = withAchievements(state, writes, now);
  return { result: { card: next, xpEarned: award, unlockedAchievements: unlocked }, writes };
}

export function setSaved(state: LearnerState, wordId: string, saved: boolean, now = new Date()) {
  const card = state.vocab[wordId] ?? newUserWord(wordId, now);
  const next: UserWord = { ...card, saved, learned: card.learned || saved };
  return { result: { card: next }, writes: { vocab: [next] } as Writes };
}

// ── Speaking / tutor / writing practice ─────────────────────

export type PracticeKind = "speaking" | "tutor" | "writing";

export function recordPractice(state: LearnerState, kind: PracticeKind, now = new Date()) {
  const day = today(state, now);
  const act = activityFor(state, day);
  let award = 0;
  if (kind === "speaking") {
    award = act.speaking * XP.speaking < XP.speakingDailyCap ? XP.speaking : 0;
    act.speaking += 1;
  } else if (kind === "tutor") {
    award = act.tutorMessages * XP.tutor < XP.tutorDailyCap ? XP.tutor : 0;
    act.tutorMessages += 1;
  } else {
    award = act.writing * XP.writing < XP.writingDailyCap ? XP.writing : 0;
    act.writing += 1;
  }
  act.xp += award;
  const writes: Writes = { activity: [act], xp: award ? [xpTx(award, kind, null, day, now)] : [] };
  const { unlocked } = withAchievements(state, writes, now);
  return { result: { xpEarned: award, unlockedAchievements: unlocked }, writes };
}

export function claimMissions(state: LearnerState, now = new Date()) {
  const day = today(state, now);
  const act = activityFor(state, day);
  if (act.missionsClaimed) throw new Error("Daily missions already claimed today");
  if (!missionsComplete(state, now)) throw new Error("Daily missions are not complete yet");
  act.missionsClaimed = true;
  act.xp += XP.missionsBonus;
  const writes: Writes = { activity: [act], xp: [xpTx(XP.missionsBonus, "missions", day, day, now)] };
  const { unlocked } = withAchievements(state, writes, now);
  return { result: { xpEarned: XP.missionsBonus, unlockedAchievements: unlocked }, writes };
}

// ── Placement ───────────────────────────────────────────────

export function completePlacement(state: LearnerState, questions: PlacementQuestion[], submissions: AnswerSubmission[]) {
  const byId = new Map(submissions.map((s) => [s.exerciseId, s.answer]));
  const units = [...new Set(questions.map((q) => q.unitOrder))].sort((a, b) => a - b);
  let startUnit = 1;
  for (const u of units) {
    const qs = questions.filter((q) => q.unitOrder === u);
    const allRight = qs.every((q) =>
      checkAnswer({ id: q.id, lessonId: "placement", order: 0, instruction: q.instruction, data: q.data, explanation: "", wordIds: [] }, byId.get(q.id) ?? "").correct,
    );
    if (!allRight) break;
    startUnit = u + 1;
  }
  const maxUnit = (units.at(-1) ?? 1) + 1;
  startUnit = Math.min(startUnit, maxUnit);
  return { result: { startUnit }, writes: { profile: { placementUnit: startUnit } } as Writes };
}

// ── Profile ─────────────────────────────────────────────────

const EDITABLE: (keyof Profile)[] = [
  "displayName", "nativeLang", "targetLang", "proficiency", "goal", "dailyMinutes", "dailyXpGoal",
  "timezone", "onboarded", "showOnLeaderboard", "theme",
];

/** Whitelist profile fields learners may change themselves (role etc. are admin-only). */
export function sanitizeProfilePatch(patch: Partial<Profile>): Partial<Profile> {
  const out: Partial<Profile> = {};
  for (const k of EDITABLE) if (k in patch) (out as Record<string, unknown>)[k] = patch[k];
  if (out.displayName !== undefined) out.displayName = String(out.displayName).trim().slice(0, 40) || "Learner";
  if (out.dailyMinutes !== undefined) out.dailyMinutes = Math.min(120, Math.max(5, Number(out.dailyMinutes) || 10));
  if (out.dailyXpGoal !== undefined) out.dailyXpGoal = Math.min(500, Math.max(10, Number(out.dailyXpGoal) || 20));
  return out;
}

// ── Applying writes ─────────────────────────────────────────

export function applyWrites(state: LearnerState, w: Writes): LearnerState {
  const next: LearnerState = {
    ...state,
    profile: w.profile ? { ...state.profile, ...w.profile } : state.profile,
    lessonProgress: { ...state.lessonProgress },
    activity: { ...state.activity },
    vocab: { ...state.vocab },
    achievements: { ...state.achievements },
    xpTotal: state.xpTotal + (w.xp ?? []).reduce((n, t) => n + t.amount, 0),
    recentAttempts: w.attempts?.length ? [...w.attempts, ...state.recentAttempts].slice(0, 300) : state.recentAttempts,
  };
  for (const p of w.lessonProgress ?? []) next.lessonProgress[p.lessonId] = p;
  for (const a of w.activity ?? []) next.activity[a.day] = a;
  for (const v of w.vocab ?? []) next.vocab[v.wordId] = v;
  for (const a of w.achievements ?? []) next.achievements[a.id] = a.unlockedAt;
  return next;
}

export function emptyLearnerState(profile: Profile): LearnerState {
  return { profile, lessonProgress: {}, activity: {}, xpTotal: 0, vocab: {}, achievements: {}, recentAttempts: [] };
}
