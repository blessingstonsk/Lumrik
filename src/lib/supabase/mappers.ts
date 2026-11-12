/** Row ⇄ domain-type mapping for Postgres tables (snake_case ⇄ camelCase). */
import type {
  Course,
  DailyActivity,
  Exercise,
  ExerciseAttempt,
  Language,
  Lesson,
  LessonProgress,
  LessonSummary,
  Profile,
  Unit,
  UserWord,
  VocabWord,
  XpTransaction,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toProfile = (r: Row): Profile => ({
  id: r.id,
  email: r.email ?? "",
  displayName: r.display_name,
  nativeLang: r.native_lang,
  targetLang: r.target_lang,
  proficiency: r.proficiency,
  goal: r.goal,
  dailyMinutes: r.daily_minutes,
  dailyXpGoal: r.daily_xp_goal,
  timezone: r.timezone,
  role: r.role,
  onboarded: r.onboarded,
  placementUnit: r.placement_unit,
  showOnLeaderboard: r.show_on_leaderboard,
  theme: r.theme,
  createdAt: r.created_at,
});

export const fromProfile = (p: Partial<Profile>): Row => {
  const m: Record<string, string> = {
    displayName: "display_name", nativeLang: "native_lang", targetLang: "target_lang", proficiency: "proficiency",
    goal: "goal", dailyMinutes: "daily_minutes", dailyXpGoal: "daily_xp_goal", timezone: "timezone",
    onboarded: "onboarded", placementUnit: "placement_unit", showOnLeaderboard: "show_on_leaderboard", theme: "theme",
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) if (m[k]) out[m[k]] = v;
  return out;
};

export const toProgress = (r: Row): LessonProgress => ({
  lessonId: r.lesson_id,
  status: "completed",
  bestScore: r.best_score,
  attempts: r.attempts,
  firstCompletedAt: r.first_completed_at,
  lastCompletedAt: r.last_completed_at,
});
export const fromProgress = (userId: string, p: LessonProgress): Row => ({
  user_id: userId,
  lesson_id: p.lessonId,
  status: p.status,
  best_score: p.bestScore,
  attempts: p.attempts,
  first_completed_at: p.firstCompletedAt,
  last_completed_at: p.lastCompletedAt,
});

export const toActivity = (r: Row): DailyActivity => ({
  day: r.day,
  xp: r.xp,
  lessons: r.lessons,
  reviews: r.reviews,
  speaking: r.speaking,
  tutorMessages: r.tutor_messages,
  writing: r.writing,
  missionsClaimed: r.missions_claimed,
});
export const fromActivity = (userId: string, a: DailyActivity): Row => ({
  user_id: userId,
  day: a.day,
  xp: a.xp,
  lessons: a.lessons,
  reviews: a.reviews,
  speaking: a.speaking,
  tutor_messages: a.tutorMessages,
  writing: a.writing,
  missions_claimed: a.missionsClaimed,
});

export const toUserWord = (r: Row): UserWord => ({
  wordId: r.word_id,
  saved: r.saved,
  learned: r.learned,
  ease: Number(r.ease),
  interval: r.interval_days,
  reps: r.reps,
  lapses: r.lapses,
  due: r.due,
  lastReviewed: r.last_reviewed,
  correct: r.correct,
  incorrect: r.incorrect,
});
export const fromUserWord = (userId: string, w: UserWord): Row => ({
  user_id: userId,
  word_id: w.wordId,
  saved: w.saved,
  learned: w.learned,
  ease: w.ease,
  interval_days: w.interval,
  reps: w.reps,
  lapses: w.lapses,
  due: w.due,
  last_reviewed: w.lastReviewed,
  correct: w.correct,
  incorrect: w.incorrect,
});

export const toAttempt = (r: Row): ExerciseAttempt => ({
  id: r.id,
  exerciseId: r.exercise_id,
  lessonId: r.lesson_id,
  type: r.type,
  correct: r.correct,
  answer: r.answer,
  createdAt: r.created_at,
});
export const fromAttempt = (userId: string, a: ExerciseAttempt): Row => ({
  id: a.id,
  user_id: userId,
  exercise_id: a.exerciseId,
  lesson_id: a.lessonId.startsWith("review") ? "review" : a.lessonId,
  type: a.type,
  correct: a.correct,
  answer: a.answer,
  created_at: a.createdAt,
});

export const fromXp = (userId: string, t: XpTransaction): Row => ({
  id: t.id,
  user_id: userId,
  amount: t.amount,
  reason: t.reason,
  ref_id: t.refId,
  day: t.day,
  created_at: t.createdAt,
});

export const toLanguage = (r: Row): Language & { glyph: string } => ({
  code: r.code,
  name: r.name,
  nativeName: r.native_name,
  flag: r.flag,
  glyph: r.glyph,
  script: r.script,
  speechLocale: r.speech_locale,
  rtl: r.rtl,
  enabled: r.enabled,
});
export const fromLanguage = (l: Language & { glyph?: string }): Row => ({
  code: l.code,
  name: l.name,
  native_name: l.nativeName,
  flag: l.flag,
  glyph: l.glyph ?? l.code.slice(0, 2),
  script: l.script,
  speech_locale: l.speechLocale,
  rtl: !!l.rtl,
  enabled: l.enabled,
});

export const toExercise = (r: Row): Exercise => ({
  id: r.id,
  lessonId: r.lesson_id,
  order: r.position,
  instruction: r.instruction,
  data: r.data,
  explanation: r.explanation,
  wordIds: r.word_ids ?? [],
});
export const fromExercise = (e: Exercise): Row => ({
  id: e.id,
  lesson_id: e.lessonId,
  position: e.order,
  type: e.data.type,
  instruction: e.instruction,
  data: e.data,
  explanation: e.explanation,
  word_ids: e.wordIds,
});

export const toLessonSummary = (r: Row): LessonSummary => ({
  id: r.id,
  unitId: r.unit_id,
  order: r.position,
  title: r.title,
  description: r.description,
  xpReward: r.xp_reward,
  published: r.published,
  exerciseCount: Array.isArray(r.exercises) ? (r.exercises[0]?.count ?? r.exercises.length) : 0,
});

export const toLesson = (r: Row): Lesson => ({
  ...toLessonSummary(r),
  tip: r.tip ?? undefined,
  exercises: ((r.exercises ?? []) as Row[]).map(toExercise).sort((a, b) => a.order - b.order),
  exerciseCount: (r.exercises ?? []).length,
});

export const toCourse = (r: Row): Course => ({
  id: r.id,
  targetLang: r.target_lang,
  title: r.title,
  description: r.description,
  published: r.published,
  units: ((r.units ?? []) as Row[])
    .map(
      (u): Unit => ({
        id: u.id,
        courseId: u.course_id,
        order: u.position,
        title: u.title,
        description: u.description,
        cefr: u.cefr,
        icon: u.icon,
        published: u.published,
        lessons: ((u.lessons ?? []) as Row[]).map(toLessonSummary).sort((a, b) => a.order - b.order),
      }),
    )
    .sort((a, b) => a.order - b.order),
});

export const toVocab = (r: Row): VocabWord => ({
  id: r.id,
  courseId: r.course_id,
  lessonId: r.lesson_id,
  term: r.term,
  meaning: r.meaning,
  pronunciation: r.pronunciation,
  partOfSpeech: r.part_of_speech,
  example: r.example,
  related: r.related ?? [],
  emoji: r.emoji ?? undefined,
  audioUrl: r.audio_url,
});
export const fromVocab = (v: VocabWord): Row => ({
  id: v.id,
  course_id: v.courseId,
  lesson_id: v.lessonId,
  term: v.term,
  meaning: v.meaning,
  pronunciation: v.pronunciation,
  part_of_speech: v.partOfSpeech,
  example: v.example,
  related: v.related,
  emoji: v.emoji ?? null,
  audio_url: v.audioUrl ?? null,
});
