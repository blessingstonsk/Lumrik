import { addDays, dayKey, diffDays, weekStart } from "./dates";
import type { DailyActivity, LearnerState } from "./types";

// ── XP rules (single source of truth, enforced on the server) ──
export const XP = {
  lessonPerCorrect: 2,
  lessonBase: 5,
  perfectBonus: 5,
  repeatMultiplier: 0.5,
  review: 1,
  reviewDailyCap: 30,
  speaking: 2,
  speakingDailyCap: 20,
  tutor: 1,
  tutorDailyCap: 15,
  writing: 5,
  writingDailyCap: 20,
  missionsBonus: 15,
};

export function emptyActivity(day: string): DailyActivity {
  return { day, xp: 0, lessons: 0, reviews: 0, speaking: 0, tutorMessages: 0, writing: 0, missionsClaimed: false };
}

/** Consecutive active days ending today (or yesterday, if today has no activity yet). */
export function computeStreak(activity: Record<string, DailyActivity>, today: string): { current: number; longest: number; activeToday: boolean } {
  const active = new Set(Object.values(activity).filter((a) => a.xp > 0).map((a) => a.day));
  const activeToday = active.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const days = [...active].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDays(days[i], days[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest, activeToday };
}

// ── Levels ──
/** XP needed to reach level n (n ≥ 1): grows gently. */
export function xpForLevel(level: number) {
  return Math.round(50 * (level - 1) * (level + 2) * 0.5);
}
export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, progress: (xp - floor) / (next - floor), intoLevel: xp - floor, needed: next - floor };
}

// ── Stats & achievements ──
export interface LearnerStats {
  xp: number;
  lessonsCompleted: number;
  perfectLessons: number;
  wordsLearned: number;
  reviews: number;
  speaking: number;
  tutorMessages: number;
  writing: number;
  streak: number;
  longestStreak: number;
}

export function computeStats(state: LearnerState, now = new Date()): LearnerStats {
  const today = dayKey(now, state.profile.timezone);
  const s = computeStreak(state.activity, today);
  const acts = Object.values(state.activity);
  const sum = (k: keyof DailyActivity) => acts.reduce((n, a) => n + (Number(a[k]) || 0), 0);
  return {
    xp: state.xpTotal,
    lessonsCompleted: Object.keys(state.lessonProgress).length,
    perfectLessons: Object.values(state.lessonProgress).filter((p) => p.bestScore === 100).length,
    wordsLearned: Object.values(state.vocab).filter((v) => v.learned).length,
    reviews: sum("reviews"),
    speaking: sum("speaking"),
    tutorMessages: sum("tutorMessages"),
    writing: sum("writing"),
    streak: s.current,
    longestStreak: s.longest,
  };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold";
  metric: keyof LearnerStats;
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-lesson", title: "First Steps", description: "Complete your first lesson", icon: "🎯", tier: "bronze", metric: "lessonsCompleted", target: 1 },
  { id: "lessons-5", title: "Getting Going", description: "Complete 5 lessons", icon: "📘", tier: "bronze", metric: "lessonsCompleted", target: 5 },
  { id: "lessons-12", title: "Halfway Hero", description: "Complete 12 lessons", icon: "🧭", tier: "silver", metric: "lessonsCompleted", target: 12 },
  { id: "lessons-24", title: "Course Champion", description: "Complete 24 lessons", icon: "🏆", tier: "gold", metric: "lessonsCompleted", target: 24 },
  { id: "perfect-1", title: "Flawless", description: "Finish a lesson with 100%", icon: "💎", tier: "bronze", metric: "perfectLessons", target: 1 },
  { id: "perfect-10", title: "Perfectionist", description: "Finish 10 lessons with 100%", icon: "👑", tier: "gold", metric: "perfectLessons", target: 10 },
  { id: "streak-3", title: "On Fire", description: "Reach a 3-day streak", icon: "🔥", tier: "bronze", metric: "longestStreak", target: 3 },
  { id: "streak-7", title: "Week Warrior", description: "Reach a 7-day streak", icon: "⚡", tier: "silver", metric: "longestStreak", target: 7 },
  { id: "streak-30", title: "Unstoppable", description: "Reach a 30-day streak", icon: "🌋", tier: "gold", metric: "longestStreak", target: 30 },
  { id: "xp-100", title: "XP Hunter", description: "Earn 100 XP", icon: "✨", tier: "bronze", metric: "xp", target: 100 },
  { id: "xp-500", title: "XP Collector", description: "Earn 500 XP", icon: "🌟", tier: "silver", metric: "xp", target: 500 },
  { id: "xp-1500", title: "XP Legend", description: "Earn 1,500 XP", icon: "🚀", tier: "gold", metric: "xp", target: 1500 },
  { id: "words-25", title: "Word Collector", description: "Learn 25 words", icon: "📚", tier: "bronze", metric: "wordsLearned", target: 25 },
  { id: "words-100", title: "Wordsmith", description: "Learn 100 words", icon: "🖋️", tier: "silver", metric: "wordsLearned", target: 100 },
  { id: "reviews-50", title: "Memory Builder", description: "Review 50 flashcards", icon: "🧠", tier: "silver", metric: "reviews", target: 50 },
  { id: "speaking-1", title: "Found My Voice", description: "Complete a speaking practice", icon: "🎙️", tier: "bronze", metric: "speaking", target: 1 },
  { id: "speaking-25", title: "Smooth Talker", description: "Complete 25 speaking practices", icon: "🗣️", tier: "silver", metric: "speaking", target: 25 },
  { id: "tutor-1", title: "Conversationalist", description: "Chat with the AI tutor", icon: "💬", tier: "bronze", metric: "tutorMessages", target: 1 },
  { id: "writing-1", title: "Pen Pal", description: "Get feedback on your writing", icon: "✍️", tier: "bronze", metric: "writing", target: 1 },
];

export function newlyUnlocked(state: LearnerState, stats: LearnerStats): string[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && stats[a.metric] >= a.target).map((a) => a.id);
}

// ── Daily missions & weekly challenge ──
export interface Mission {
  id: string;
  title: string;
  icon: string;
  progress: number;
  target: number;
}

export function dailyMissions(state: LearnerState, now = new Date()): Mission[] {
  const today = dayKey(now, state.profile.timezone);
  const a = state.activity[today];
  return [
    { id: "xp", title: `Earn ${state.profile.dailyXpGoal} XP`, icon: "⚡", progress: a?.xp ?? 0, target: state.profile.dailyXpGoal },
    { id: "lessons", title: "Complete 2 lessons", icon: "📘", progress: a?.lessons ?? 0, target: 2 },
    { id: "reviews", title: "Review 10 flashcards", icon: "🧠", progress: a?.reviews ?? 0, target: 10 },
  ];
}

export function missionsComplete(state: LearnerState, now = new Date()) {
  return dailyMissions(state, now).every((m) => m.progress >= m.target);
}

export function weeklyChallenge(state: LearnerState, now = new Date()) {
  const today = dayKey(now, state.profile.timezone);
  const start = weekStart(today);
  const xp = Object.values(state.activity)
    .filter((a) => a.day >= start && a.day <= today)
    .reduce((n, a) => n + a.xp, 0);
  const target = Math.max(150, state.profile.dailyXpGoal * 5);
  return { title: `Earn ${target} XP this week`, progress: xp, target, weekStart: start, endsIn: 7 - diffDays(today, start) };
}

/** Daily XP goal derived from minutes per day (≈ 2 XP per minute of focused practice). */
export function xpGoalForMinutes(minutes: number) {
  return Math.max(10, Math.round(minutes * 2));
}
