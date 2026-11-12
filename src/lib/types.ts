// ─────────────────────────────────────────────────────────────
// Shared domain types for Lumrik (used by client, server and seed script)
// ─────────────────────────────────────────────────────────────

export type LanguageCode =
  | "en" | "ta" | "hi" | "ml" | "te" | "kn" | "fr" | "es" | "de" | "ja" | "ko"
  | (string & {});

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type Proficiency = "beginner" | "elementary" | "intermediate" | "advanced";
export type LearningGoal = "travel" | "education" | "career" | "communication" | "personal";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string; // emoji used as a language icon
  script: string; // e.g. "Latin", "Tamil", "Devanagari"
  speechLocale: string; // BCP-47 tag for TTS / speech recognition
  rtl?: boolean;
  enabled: boolean;
}

// ── Content ──────────────────────────────────────────────────

export interface VocabWord {
  id: string;
  courseId: string;
  lessonId: string | null;
  term: string;
  meaning: string; // learner-facing meaning (definition / translation)
  pronunciation: string; // IPA
  partOfSpeech: string;
  example: string;
  related: string[];
  emoji?: string;
  audioUrl?: string | null;
}

export type ExerciseType =
  | "multiple_choice"
  | "match_pairs"
  | "fill_blank"
  | "listening"
  | "speaking"
  | "sentence_builder"
  | "translate";

export interface MultipleChoiceData {
  question: string;
  image?: string; // emoji illustration
  choices: string[];
  answer: number;
  speak?: string; // optional text for a "listen" button
}
export interface MatchPairsData {
  pairs: { left: string; right: string }[];
}
export interface FillBlankData {
  /** Sentence with "___" marking the blank. */
  sentence: string;
  /** If present, learner picks from choices; otherwise types. */
  choices?: string[];
  answers: string[]; // accepted answers
  hint?: string;
}
export interface ListeningData {
  audioText: string;
  mode: "choose" | "type";
  choices?: string[];
  answer?: number;
  accepted?: string[];
}
export interface SpeakingData {
  text: string;
  translation?: string;
}
export interface SentenceBuilderData {
  prompt?: string;
  answer: string; // canonical sentence
  extraWords?: string[]; // distractors
  accepted?: string[]; // other valid orders
}
export interface TranslateData {
  source: string;
  sourceLabel?: string;
  accepted: string[];
}

export type ExerciseData =
  | ({ type: "multiple_choice" } & MultipleChoiceData)
  | ({ type: "match_pairs" } & MatchPairsData)
  | ({ type: "fill_blank" } & FillBlankData)
  | ({ type: "listening" } & ListeningData)
  | ({ type: "speaking" } & SpeakingData)
  | ({ type: "sentence_builder" } & SentenceBuilderData)
  | ({ type: "translate" } & TranslateData);

export interface Exercise {
  id: string;
  lessonId: string;
  order: number;
  instruction: string;
  data: ExerciseData;
  explanation: string;
  wordIds: string[]; // vocabulary practised by this exercise (for mistake tracking)
}

export interface LessonSummary {
  id: string;
  unitId: string;
  order: number;
  title: string;
  description: string;
  xpReward: number;
  published: boolean;
  exerciseCount: number;
}

export interface Lesson extends LessonSummary {
  tip?: string; // short teaching note shown before exercises
  exercises: Exercise[];
}

export interface Unit {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description: string;
  cefr: CefrLevel;
  icon: string;
  published: boolean;
  lessons: LessonSummary[];
}

export interface Course {
  id: string;
  targetLang: LanguageCode;
  title: string;
  description: string;
  published: boolean;
  units: Unit[];
}

export interface PlacementQuestion {
  id: string;
  unitOrder: number; // the unit this question checks
  data: ExerciseData;
  instruction: string;
}

// ── Learner state ────────────────────────────────────────────

export type Role = "learner" | "admin";

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  nativeLang: LanguageCode;
  targetLang: LanguageCode;
  proficiency: Proficiency;
  goal: LearningGoal;
  dailyMinutes: number;
  dailyXpGoal: number;
  timezone: string;
  role: Role;
  onboarded: boolean;
  placementUnit: number; // units before this order are unlocked via placement test
  showOnLeaderboard: boolean;
  theme: "system" | "light" | "dark";
  createdAt: string;
}

export interface LessonProgress {
  lessonId: string;
  status: "completed";
  bestScore: number; // 0..100
  attempts: number;
  firstCompletedAt: string;
  lastCompletedAt: string;
}

export interface ExerciseAttempt {
  id: string;
  exerciseId: string;
  lessonId: string;
  type: ExerciseType;
  correct: boolean;
  answer: string;
  createdAt: string;
}

export interface DailyActivity {
  day: string; // YYYY-MM-DD in the learner's timezone
  xp: number;
  lessons: number;
  reviews: number;
  speaking: number;
  tutorMessages: number;
  writing: number;
  missionsClaimed: boolean;
}

export interface XpTransaction {
  id: string;
  amount: number;
  reason: "lesson" | "lesson_repeat" | "perfect_bonus" | "review" | "speaking" | "tutor" | "writing" | "missions" | "placement";
  refId: string | null;
  day: string;
  createdAt: string;
}

export interface UserWord {
  wordId: string;
  saved: boolean;
  learned: boolean;
  ease: number;
  interval: number; // days
  reps: number;
  lapses: number;
  due: string; // ISO timestamp
  lastReviewed: string | null;
  correct: number;
  incorrect: number;
}

export interface LearnerState {
  profile: Profile;
  lessonProgress: Record<string, LessonProgress>;
  activity: Record<string, DailyActivity>;
  xpTotal: number;
  vocab: Record<string, UserWord>;
  achievements: Record<string, string>; // id -> unlockedAt
  recentAttempts: ExerciseAttempt[];
}

/** A set of changes produced by the learning engine. Applied identically locally and in Postgres. */
export interface Writes {
  profile?: Partial<Profile>;
  lessonProgress?: LessonProgress[];
  attempts?: ExerciseAttempt[];
  xp?: XpTransaction[];
  activity?: DailyActivity[];
  vocab?: UserWord[];
  achievements?: { id: string; unlockedAt: string }[];
}

export interface AnswerSubmission {
  exerciseId: string;
  answer: string; // serialized learner answer (first attempt)
  skipped?: boolean; // e.g. speaking exercise skipped (no mic)
}

export interface ExerciseCheck {
  correct: boolean;
  /** Accepted with a small typo. */
  typo?: boolean;
  expected: string;
}

export interface LessonCompletionResult {
  lessonId: string;
  correct: number;
  total: number;
  score: number;
  xpEarned: number;
  perfect: boolean;
  firstCompletion: boolean;
  newWords: number;
  streak: number;
  streakExtended: boolean;
  unlockedAchievements: string[];
}
