import type { ExerciseData, PlacementQuestion } from "@/lib/types";
import { compileCourse, type CourseDef } from "./builders";
import { unit1, unit2, unit3 } from "./english/units-1-3";
import { unit4, unit5, unit6 } from "./english/units-4-6";

export const ENGLISH_COURSE_DEF: CourseDef = {
  id: "en-beginner",
  targetLang: "en",
  title: "English for Beginners",
  description: "From the alphabet to everyday conversations (CEFR A1–A2). 24 lessons, 6 units.",
  units: [unit1, unit2, unit3, unit4, unit5, unit6],
};

/** Built-in content shipped with the app (also exported to supabase/seed.sql). */
export const BUILTIN = (() => {
  const english = compileCourse(ENGLISH_COURSE_DEF);
  return { courses: [english.course], lessons: english.lessons, vocab: english.vocab };
})();

const q = (id: string, unitOrder: number, instruction: string, data: ExerciseData): PlacementQuestion => ({ id, unitOrder, instruction, data });

/**
 * Placement test for the English course: two questions per unit (units 1–5).
 * Answering both questions of a unit correctly lets the learner skip ahead past it.
 */
export const ENGLISH_PLACEMENT: PlacementQuestion[] = [
  q("p1a", 1, "Choose the correct answer", { type: "multiple_choice", question: "Which letter comes after P?", choices: ["O", "Q", "R", "B"], answer: 1 }),
  q("p1b", 1, "Choose the correct answer", { type: "multiple_choice", question: "Which of these is a vowel?", choices: ["T", "S", "U", "K"], answer: 2 }),
  q("p2a", 2, "Choose the best reply", { type: "multiple_choice", question: "“Nice to meet you.”", choices: ["Goodbye.", "Nice to meet you too.", "I'm 20.", "Good night."], answer: 1 }),
  q("p2b", 2, "Fill in the blank", { type: "fill_blank", sentence: "___ me, where is the bank?", choices: ["Sorry", "Excuse", "Please"], answers: ["Excuse"] }),
  q("p3a", 3, "Write the number in words", { type: "translate", source: "15", sourceLabel: "Number", accepted: ["fifteen"] }),
  q("p3b", 3, "Choose the correct sentence", { type: "multiple_choice", question: "Talking about age:", choices: ["I have 30 years.", "I am 30 years old.", "I am 30 years.", "I have 30 years old."], answer: 1 }),
  q("p4a", 4, "Fill in the blank", { type: "fill_blank", sentence: "There ___ two chairs in the kitchen.", choices: ["is", "are", "am"], answers: ["are"] }),
  q("p4b", 4, "Fill in the blank", { type: "fill_blank", sentence: "The film starts ___ 8 o'clock.", choices: ["on", "in", "at"], answers: ["at"] }),
  q("p5a", 5, "Choose the most polite option", { type: "multiple_choice", question: "Ordering in a café:", choices: ["Give me a coffee.", "I'd like a coffee, please.", "Coffee.", "I want coffee now."], answer: 1 }),
  q("p5b", 5, "Fill in the blank", { type: "fill_blank", sentence: "How much ___ these shoes?", choices: ["is", "are", "am"], answers: ["are"] }),
];

export const PLACEMENT_BY_COURSE: Record<string, PlacementQuestion[]> = {
  "en-beginner": ENGLISH_PLACEMENT,
};
