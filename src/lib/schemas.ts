/** Zod schemas used to validate admin-authored content before it is saved. */
import { z } from "zod";

const str = z.string().min(1);

export const ExerciseDataSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multiple_choice"), question: str, image: z.string().optional(), choices: z.array(str).min(2).max(6), answer: z.number().int().min(0), speak: z.string().optional() }).refine((d) => d.answer < d.choices.length, "answer must be a valid choice index"),
  z.object({ type: z.literal("match_pairs"), pairs: z.array(z.object({ left: str, right: str })).min(2).max(6) }),
  z.object({ type: z.literal("fill_blank"), sentence: str.refine((s) => s.includes("___"), "sentence must contain ___"), choices: z.array(str).optional(), answers: z.array(str).min(1), hint: z.string().optional() }),
  z.object({ type: z.literal("listening"), audioText: str, mode: z.enum(["choose", "type"]), choices: z.array(str).optional(), answer: z.number().int().optional(), accepted: z.array(str).optional() }).refine((d) => d.mode === "type" || (d.choices && d.answer !== undefined && d.answer < d.choices.length), "choose mode needs choices and a valid answer index"),
  z.object({ type: z.literal("speaking"), text: str, translation: z.string().optional() }),
  z.object({ type: z.literal("sentence_builder"), prompt: z.string().optional(), answer: str, extraWords: z.array(str).optional(), accepted: z.array(str).optional() }),
  z.object({ type: z.literal("translate"), source: str, sourceLabel: z.string().optional(), accepted: z.array(str).min(1) }),
]);

export const ExerciseSchema = z.object({
  id: str,
  instruction: str,
  explanation: z.string(),
  wordIds: z.array(z.string()).default([]),
  data: ExerciseDataSchema,
});

export const ExerciseListSchema = z.array(ExerciseSchema).min(1).max(30);

export const LanguageSchema = z.object({
  code: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/, "Use an ISO code like 'pt' or 'pt-BR'"),
  name: str,
  nativeName: str,
  flag: z.string().default("🌐"),
  glyph: z.string().min(1).max(3),
  script: str,
  speechLocale: str,
  enabled: z.boolean(),
});
