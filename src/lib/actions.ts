/**
 * Learner actions: one executor shared by local mode (browser) and the API route (server).
 * The context supplies trusted content (from TS sources locally, from Postgres on the server).
 */
import { buildReviewExercise } from "./adaptive";
import { claimMissions, completeLesson, completePlacement, recordPractice, reviewCard, sanitizeProfilePatch, setSaved } from "./engine";
import type { Grade } from "./srs";
import type { AnswerSubmission, LearnerState, Lesson, PlacementQuestion, Profile, VocabWord, Writes } from "./types";

export type LearnerAction =
  | { type: "completeLesson"; lessonId: string; answers: AnswerSubmission[] }
  | { type: "completeReview"; exerciseIds: string[]; answers: AnswerSubmission[] }
  | { type: "reviewCard"; wordId: string; grade: Grade }
  | { type: "saveWord"; wordId: string; saved: boolean }
  | { type: "practice"; kind: "speaking" | "writing" | "tutor" }
  | { type: "claimMissions" }
  | { type: "placement"; courseId: string; answers: AnswerSubmission[] }
  | { type: "updateProfile"; patch: Partial<Profile> };

export interface ActionContext {
  getLesson(id: string): Promise<Lesson | null>;
  getVocabulary(): Promise<VocabWord[]>; // all vocabulary of the learner's course(s)
  getPlacement(courseId: string): Promise<PlacementQuestion[]>;
  wordExists(id: string): Promise<boolean>;
}

export interface ActionOutcome {
  result: unknown;
  writes: Writes;
}

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export class ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertAnswers(answers: unknown): asserts answers is AnswerSubmission[] {
  if (!Array.isArray(answers) || answers.length > 50) throw new ActionError("Invalid answers");
  for (const a of answers) {
    if (!a || typeof a.exerciseId !== "string" || typeof a.answer !== "string" || a.answer.length > 2000) throw new ActionError("Invalid answer");
  }
}

export async function runAction(state: LearnerState, action: LearnerAction, ctx: ActionContext, now = new Date()): Promise<ActionOutcome> {
  switch (action.type) {
    case "completeLesson": {
      assertAnswers(action.answers);
      const lesson = await ctx.getLesson(action.lessonId);
      if (!lesson || !lesson.published) throw new ActionError("Lesson not found", 404);
      try {
        return completeLesson(state, lesson, action.answers, now);
      } catch (e) {
        throw new ActionError((e as Error).message);
      }
    }
    case "completeReview": {
      assertAnswers(action.answers);
      if (!Array.isArray(action.exerciseIds) || action.exerciseIds.length === 0 || action.exerciseIds.length > 10) throw new ActionError("Invalid review");
      const words = await ctx.getVocabulary();
      const exercises = action.exerciseIds.map((id, i) => {
        const ex = buildReviewExercise(String(id), words);
        if (!ex) throw new ActionError("Unknown review exercise");
        return { ...ex, order: i + 1 };
      });
      const lesson: Lesson = { id: "review", unitId: "review", order: 0, title: "Review", description: "", xpReward: 0, published: true, exerciseCount: exercises.length, exercises };
      try {
        return completeLesson(state, lesson, action.answers, now, { isReview: true });
      } catch (e) {
        throw new ActionError((e as Error).message);
      }
    }
    case "reviewCard": {
      if (!GRADES.includes(action.grade)) throw new ActionError("Invalid grade");
      if (!(await ctx.wordExists(action.wordId))) throw new ActionError("Unknown word", 404);
      return reviewCard(state, action.wordId, action.grade, now);
    }
    case "saveWord": {
      if (!(await ctx.wordExists(action.wordId))) throw new ActionError("Unknown word", 404);
      return setSaved(state, action.wordId, !!action.saved, now);
    }
    case "practice": {
      if (!["speaking", "writing", "tutor"].includes(action.kind)) throw new ActionError("Invalid practice kind");
      return recordPractice(state, action.kind, now);
    }
    case "claimMissions": {
      try {
        return claimMissions(state, now);
      } catch (e) {
        throw new ActionError((e as Error).message, 409);
      }
    }
    case "placement": {
      assertAnswers(action.answers);
      const qs = await ctx.getPlacement(action.courseId);
      if (!qs.length) throw new ActionError("No placement test for this course", 404);
      return completePlacement(state, qs, action.answers);
    }
    case "updateProfile": {
      const patch = sanitizeProfilePatch(action.patch ?? {});
      return { result: { profile: patch }, writes: { profile: patch } };
    }
    default:
      throw new ActionError("Unknown action");
  }
}
