"use client";
import { PLACEMENT_BY_COURSE } from "@/content";
import { runAction, type ActionContext, type LearnerAction } from "../actions";
import { isSupabaseEnabled } from "../config";
import { applyWrites } from "../engine";
import type { LearnerState, Writes } from "../types";
import { contentRepo } from "./content";
import { loadLocalState, saveLocalState } from "./local-store";

export interface ActionResponse<R = unknown> {
  result: R;
  writes: Writes;
}

export interface LearnerRepo {
  load(userId: string): Promise<LearnerState>;
  act<R = unknown>(state: LearnerState, action: LearnerAction): Promise<ActionResponse<R>>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(init?: RequestInit): Promise<T> {
  const res = await fetch("/api/learner", { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

const remoteRepo: LearnerRepo = {
  async load() {
    return (await api<{ state: LearnerState }>()).state;
  },
  async act(_state, action) {
    return api(({ method: "POST", body: JSON.stringify(action) }));
  },
};

function localContext(targetLang: string): ActionContext {
  return {
    getLesson: (id) => contentRepo.getLesson(id),
    async getVocabulary() {
      const course = await contentRepo.getCourseForLang(targetLang);
      return course ? contentRepo.getVocabulary(course.id) : [];
    },
    async getPlacement(courseId) {
      return PLACEMENT_BY_COURSE[courseId] ?? [];
    },
    async wordExists(id) {
      const courses = await contentRepo.listCourses(true);
      for (const c of courses) if ((await contentRepo.getVocabulary(c.id)).some((v) => v.id === id)) return true;
      return false;
    },
  };
}

const localRepo: LearnerRepo = {
  async load(userId) {
    const s = loadLocalState(userId);
    if (!s) throw new ApiError("No local profile found. Please sign up again.", 404);
    return s;
  },
  async act(state, action) {
    const outcome = await runAction(state, action, localContext(state.profile.targetLang));
    // Re-read from storage to stay consistent across tabs, then apply & persist.
    const fresh = loadLocalState(state.profile.id) ?? state;
    saveLocalState(applyWrites(fresh, outcome.writes));
    return outcome as ActionResponse<never>;
  },
};

export const learnerRepo: LearnerRepo = isSupabaseEnabled ? remoteRepo : localRepo;
