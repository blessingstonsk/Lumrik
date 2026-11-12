/**
 * Small authoring DSL for course content. Content is authored in TypeScript (type-checked),
 * then either used directly (local mode) or exported to SQL seed data for Supabase
 * (`npm run seed:generate`). After seeding, admins edit content in the database.
 */
import type {
  CefrLevel,
  Course,
  Exercise,
  ExerciseData,
  Lesson,
  Unit,
  VocabWord,
} from "@/lib/types";

export interface WordDef {
  term: string;
  meaning: string;
  ipa: string;
  pos: string;
  example: string;
  related?: string[];
  emoji?: string;
}

export interface ExDef {
  instruction?: string;
  explanation: string;
  data: ExerciseData;
}

export interface LessonDef {
  title: string;
  description: string;
  tip?: string;
  words: WordDef[];
  exercises: ExDef[];
}

export interface UnitDef {
  title: string;
  description: string;
  cefr: CefrLevel;
  icon: string;
  lessons: LessonDef[];
}

export interface CourseDef {
  id: string;
  targetLang: string;
  title: string;
  description: string;
  units: UnitDef[];
}

const DEFAULT_INSTRUCTIONS: Record<ExerciseData["type"], string> = {
  multiple_choice: "Choose the correct answer",
  match_pairs: "Match the pairs",
  fill_blank: "Fill in the blank",
  listening: "Listen and choose what you hear",
  speaking: "Say this sentence out loud",
  sentence_builder: "Put the words in the right order",
  translate: "Write the answer in English",
};

// ── Exercise helpers ─────────────────────────────────────────
export const mc = (question: string, choices: string[], answer: number, explanation: string, extra: { image?: string; speak?: string; instruction?: string } = {}): ExDef => ({
  instruction: extra.instruction,
  explanation,
  data: { type: "multiple_choice", question, choices, answer, image: extra.image, speak: extra.speak },
});
export const match = (pairs: [string, string][], explanation: string, instruction?: string): ExDef => ({
  instruction,
  explanation,
  data: { type: "match_pairs", pairs: pairs.map(([left, right]) => ({ left, right })) },
});
export const fill = (sentence: string, answers: string[], explanation: string, extra: { choices?: string[]; hint?: string; instruction?: string } = {}): ExDef => ({
  instruction: extra.instruction,
  explanation,
  data: { type: "fill_blank", sentence, answers, choices: extra.choices, hint: extra.hint },
});
export const listen = (audioText: string, choices: string[], answer: number, explanation: string): ExDef => ({
  explanation,
  data: { type: "listening", mode: "choose", audioText, choices, answer },
});
export const listenType = (audioText: string, explanation: string, accepted?: string[]): ExDef => ({
  instruction: "Listen and type what you hear",
  explanation,
  data: { type: "listening", mode: "type", audioText, accepted: accepted ?? [audioText] },
});
export const speak = (text: string, explanation: string): ExDef => ({
  explanation,
  data: { type: "speaking", text },
});
export const build = (answer: string, extraWords: string[], explanation: string, extra: { prompt?: string; accepted?: string[] } = {}): ExDef => ({
  explanation,
  data: { type: "sentence_builder", answer, extraWords, prompt: extra.prompt, accepted: extra.accepted },
});
export const tr = (source: string, accepted: string[], explanation: string, extra: { label?: string; instruction?: string } = {}): ExDef => ({
  instruction: extra.instruction,
  explanation,
  data: { type: "translate", source, sourceLabel: extra.label, accepted },
});
export const w = (term: string, meaning: string, ipa: string, pos: string, example: string, related: string[] = [], emoji?: string): WordDef => ({
  term, meaning, ipa, pos, example, related, emoji,
});

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function textOf(data: ExerciseData): string {
  return JSON.stringify(data).toLowerCase();
}

function mentions(haystack: string, term: string) {
  const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${t}([^\\p{L}]|$)`, "u").test(haystack);
}

/** Compile authored definitions into the runtime content model. */
export function compileCourse(def: CourseDef) {
  const vocab: VocabWord[] = [];
  const vocabByTerm = new Map<string, VocabWord>();
  const lessons: Lesson[] = [];
  const units: Unit[] = def.units.map((u, ui) => {
    const unitId = `${def.id}-u${ui + 1}`;
    const unitLessons = u.lessons.map((l, li) => {
      const lessonId = `${unitId}-l${li + 1}`;
      const ownWords: VocabWord[] = [];
      for (const wd of l.words) {
        const key = wd.term.toLowerCase();
        let word = vocabByTerm.get(key);
        if (!word) {
          word = {
            id: `${def.id}-w-${slugify(wd.term)}`,
            courseId: def.id,
            lessonId,
            term: wd.term,
            meaning: wd.meaning,
            pronunciation: wd.ipa,
            partOfSpeech: wd.pos,
            example: wd.example,
            related: wd.related ?? [],
            emoji: wd.emoji,
            audioUrl: null,
          };
          vocabByTerm.set(key, word);
          vocab.push(word);
        }
        ownWords.push(word);
      }
      const exercises: Exercise[] = l.exercises.map((e, ei) => {
        const hay = textOf(e.data);
        return {
          id: `${lessonId}-e${ei + 1}`,
          lessonId,
          order: ei + 1,
          instruction: e.instruction ?? DEFAULT_INSTRUCTIONS[e.data.type],
          data: e.data,
          explanation: e.explanation,
          wordIds: ownWords.filter((wd) => mentions(hay, wd.term)).map((wd) => wd.id),
        };
      });
      const lesson: Lesson = {
        id: lessonId,
        unitId,
        order: li + 1,
        title: l.title,
        description: l.description,
        tip: l.tip,
        xpReward: 5 + exercises.length * 2,
        published: true,
        exerciseCount: exercises.length,
        exercises,
      };
      lessons.push(lesson);
      return lesson;
    });
    return {
      id: unitId,
      courseId: def.id,
      order: ui + 1,
      title: u.title,
      description: u.description,
      cefr: u.cefr,
      icon: u.icon,
      published: true,
      lessons: unitLessons.map(({ exercises: _e, tip: _t, ...summary }) => summary),
    };
  });
  const course: Course = { id: def.id, targetLang: def.targetLang, title: def.title, description: def.description, published: true, units };
  return { course, lessons, vocab };
}
