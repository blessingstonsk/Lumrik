import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLACEMENT_BY_COURSE } from "@/content";
import type { ActionContext } from "../actions";
import { emptyLearnerState } from "../engine";
import {
  fromActivity,
  fromAttempt,
  fromProfile,
  fromProgress,
  fromUserWord,
  fromXp,
  toActivity,
  toAttempt,
  toLesson,
  toProfile,
  toProgress,
  toUserWord,
  toVocab,
} from "../supabase/mappers";
import type { LearnerState, Writes } from "../types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Load the full learner state for one user (service-role client, filtered by user id). */
export async function loadLearnerState(db: SupabaseClient, userId: string): Promise<LearnerState> {
  const [profile, progress, activity, vocab, achievements, attempts] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db.from("user_lesson_progress").select("*").eq("user_id", userId),
    db.from("daily_activity").select("*").eq("user_id", userId).order("day", { ascending: false }).limit(400),
    db.from("user_vocabulary").select("*").eq("user_id", userId),
    db.from("user_achievements").select("*").eq("user_id", userId),
    db.from("exercise_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(300),
  ]);
  const p = check(profile);
  const state = emptyLearnerState(toProfile(p));
  state.xpTotal = p.xp_total ?? 0;
  for (const r of check(progress) ?? []) state.lessonProgress[r.lesson_id] = toProgress(r);
  for (const r of check(activity) ?? []) state.activity[r.day] = toActivity(r);
  for (const r of check(vocab) ?? []) state.vocab[r.word_id] = toUserWord(r);
  for (const r of check(achievements) ?? []) state.achievements[r.achievement_id] = r.unlocked_at;
  state.recentAttempts = (check(attempts) ?? []).map(toAttempt);
  return state;
}

/** Persist engine writes. XP rows update profiles.xp_total via a database trigger. */
export async function persistWrites(db: SupabaseClient, userId: string, w: Writes, extra?: { reviewLog?: { wordId: string; grade: string; interval: number } }) {
  const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
  if (w.profile && Object.keys(w.profile).length) ops.push(db.from("profiles").update(fromProfile(w.profile)).eq("id", userId));
  if (w.lessonProgress?.length) ops.push(db.from("user_lesson_progress").upsert(w.lessonProgress.map((p) => fromProgress(userId, p))));
  if (w.activity?.length) ops.push(db.from("daily_activity").upsert(w.activity.map((a) => fromActivity(userId, a))));
  if (w.vocab?.length) ops.push(db.from("user_vocabulary").upsert(w.vocab.map((v) => fromUserWord(userId, v))));
  if (w.attempts?.length) ops.push(db.from("exercise_attempts").insert(w.attempts.map((a) => fromAttempt(userId, a))));
  if (w.xp?.length) ops.push(db.from("xp_transactions").insert(w.xp.map((t) => fromXp(userId, t))));
  if (w.achievements?.length)
    ops.push(db.from("user_achievements").upsert(w.achievements.map((a) => ({ user_id: userId, achievement_id: a.id, unlocked_at: a.unlockedAt })), { ignoreDuplicates: true }));
  if (extra?.reviewLog)
    ops.push(db.from("vocabulary_reviews").insert({ user_id: userId, word_id: extra.reviewLog.wordId, grade: extra.reviewLog.grade, interval_days: extra.reviewLog.interval }));
  const results = await Promise.all(ops);
  const err = results.find((r) => r.error);
  if (err?.error) throw new Error(err.error.message);
}

/** Trusted content lookups for validating learner actions on the server. */
export function serverActionContext(db: SupabaseClient, targetLang: string): ActionContext {
  let vocabCache: ReturnType<typeof toVocab>[] | null = null;
  return {
    async getLesson(id) {
      const { data, error } = await db.from("lessons").select("*, exercises(*)").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toLesson(data) : null;
    },
    async getVocabulary() {
      if (vocabCache) return vocabCache;
      const { data, error } = await db.from("vocabulary").select("*, courses!inner(target_lang)").eq("courses.target_lang", targetLang);
      if (error) throw new Error(error.message);
      vocabCache = (data ?? []).map(toVocab);
      return vocabCache;
    },
    async getPlacement(courseId) {
      return PLACEMENT_BY_COURSE[courseId] ?? [];
    },
    async wordExists(id) {
      const { count } = await db.from("vocabulary").select("id", { count: "exact", head: true }).eq("id", id);
      return (count ?? 0) > 0;
    },
  };
}
