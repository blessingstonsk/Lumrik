import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN, ENGLISH_PLACEMENT } from "../../content/index";
import { buildReviewExercise, buildReviewLesson, lessonNodes } from "../adaptive";
import { runAction } from "../actions";
import { dayKey } from "../dates";
import { applyWrites, completeLesson, emptyLearnerState, recordPractice, sanitizeProfilePatch } from "../engine";
import { computeStreak, XP } from "../gamification";
import { newUserWord, schedule } from "../srs";
import { parseTutorReply } from "../tutor";
import type { Exercise, LearnerState, Profile } from "../types";
import { canonicalAnswer } from "./content.test";

const profile = (tz = "UTC"): Profile => ({
  id: "u1", email: "t@example.test", displayName: "T", nativeLang: "ta", targetLang: "en", proficiency: "beginner",
  goal: "travel", dailyMinutes: 10, dailyXpGoal: 20, timezone: tz, role: "learner", onboarded: true, placementUnit: 1,
  showOnLeaderboard: true, theme: "system", createdAt: new Date().toISOString(),
});
const lesson = BUILTIN.lessons[0];
const allCorrect = (exs: Exercise[]) => exs.map((e) => ({ exerciseId: e.id, answer: canonicalAnswer(e) }));

test("perfect first completion awards base + per-correct + perfect bonus", () => {
  const s = emptyLearnerState(profile());
  const { result, writes } = completeLesson(s, lesson, allCorrect(lesson.exercises));
  assert.equal(result.score, 100);
  assert.equal(result.xpEarned, XP.lessonBase + lesson.exercises.length * XP.lessonPerCorrect + XP.perfectBonus);
  assert.ok(result.firstCompletion);
  assert.ok(result.unlockedAchievements.includes("first-lesson"));
  const next = applyWrites(s, writes);
  assert.equal(next.xpTotal, result.xpEarned);
  assert.ok(next.lessonProgress[lesson.id]);
});

test("repeating a lesson earns half XP and no second perfect bonus", () => {
  let s = emptyLearnerState(profile());
  s = applyWrites(s, completeLesson(s, lesson, allCorrect(lesson.exercises)).writes);
  const again = completeLesson(s, lesson, allCorrect(lesson.exercises));
  assert.equal(again.result.firstCompletion, false);
  assert.equal(again.result.xpEarned, Math.round((XP.lessonBase + lesson.exercises.length * XP.lessonPerCorrect) * XP.repeatMultiplier));
});

test("server rejects missing answers and non-audio skips", () => {
  const s = emptyLearnerState(profile());
  assert.throws(() => completeLesson(s, lesson, []));
  const answers = allCorrect(lesson.exercises).map((a, i) => (i === 0 ? { ...a, skipped: true } : a));
  assert.throws(() => completeLesson(s, lesson, answers), /audio/);
});

test("wrong answers lower score and make the word due", () => {
  const s = emptyLearnerState(profile());
  const answers = lesson.exercises.map((e) => ({ exerciseId: e.id, answer: "definitely wrong" }));
  const { result, writes } = completeLesson(s, lesson, answers);
  assert.equal(result.correct, 0);
  assert.equal(result.score, 0);
  assert.ok(writes.vocab!.length > 0 && writes.vocab!.every((v) => v.incorrect >= 1 && v.correct === 0));
});

test("streak counts consecutive local days, and today's gap does not break it", () => {
  const act = (day: string) => ({ day, xp: 10, lessons: 1, reviews: 0, speaking: 0, tutorMessages: 0, writing: 0, missionsClaimed: false });
  const a = { "2026-11-10": act("2026-11-10"), "2026-11-11": act("2026-11-11") };
  assert.deepEqual(computeStreak(a, "2026-11-12"), { current: 2, longest: 2, activeToday: false });
  assert.equal(computeStreak({ ...a, "2026-11-12": act("2026-11-12") }, "2026-11-12").current, 3);
  assert.equal(computeStreak(a, "2026-11-13").current, 0);
});

test("day keys follow the learner's timezone", () => {
  const instant = new Date("2026-11-12T20:00:00Z");
  assert.equal(dayKey(instant, "UTC"), "2026-11-12");
  assert.equal(dayKey(instant, "Asia/Kolkata"), "2026-11-13"); // 01:30 next day in India
  assert.equal(dayKey(instant, "America/Los_Angeles"), "2026-11-12");
  assert.equal(dayKey(instant, "Not/AZone"), "2026-11-12"); // falls back to UTC
});

test("practice XP is capped per day", () => {
  let s: LearnerState = emptyLearnerState(profile());
  let total = 0;
  for (let i = 0; i < 40; i++) {
    const { result, writes } = recordPractice(s, "tutor");
    total += result.xpEarned;
    s = applyWrites(s, writes);
  }
  assert.equal(total, XP.tutorDailyCap);
});

test("SM-2 scheduling grows intervals and resets on again", () => {
  const now = new Date("2026-11-12T00:00:00Z");
  let c = newUserWord("w", now, { learned: true });
  c = schedule(c, "good", now);
  assert.equal(c.interval, 1);
  c = schedule(c, "good", now);
  assert.equal(c.interval, 6);
  c = schedule(c, "good", now);
  assert.ok(c.interval > 6);
  c = schedule(c, "again", now);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1);
});

test("lessons unlock sequentially and via placement", () => {
  const course = BUILTIN.courses[0];
  const s = emptyLearnerState(profile());
  const nodes = lessonNodes(course, s);
  assert.equal(nodes[0].state, "available");
  assert.equal(nodes[1].state, "locked");
  const placed = { ...s, profile: { ...s.profile, placementUnit: 3 } };
  const n2 = lessonNodes(course, placed);
  assert.ok(n2.filter((n) => n.unitOrder < 3).every((n) => n.state === "available"));
  assert.equal(n2.find((n) => n.unitOrder === 3)!.state, "available");
  assert.equal(n2.filter((n) => n.unitOrder === 3)[1].state, "locked");
});

test("placement test places learners by first failed unit", async () => {
  const s = emptyLearnerState(profile());
  const ctx = { getLesson: async () => null, getVocabulary: async () => BUILTIN.vocab, getPlacement: async () => ENGLISH_PLACEMENT, wordExists: async () => true };
  const asEx = (q: (typeof ENGLISH_PLACEMENT)[number]) => ({ id: q.id, lessonId: "p", order: 0, instruction: "", data: q.data, explanation: "", wordIds: [] }) as Exercise;
  const answers = ENGLISH_PLACEMENT.map((q) => ({ exerciseId: q.id, answer: q.unitOrder <= 2 ? canonicalAnswer(asEx(q)) : "x" }));
  const out = await runAction(s, { type: "placement", courseId: "en-beginner", answers }, ctx);
  assert.deepEqual(out.result, { startUnit: 3 });
});

test("review exercises rebuild deterministically for server validation", () => {
  const ids = BUILTIN.vocab.slice(0, 6).map((v) => v.id);
  const l = buildReviewLesson(ids, BUILTIN.vocab, "seed1");
  for (const ex of l.exercises) assert.deepEqual(buildReviewExercise(ex.id, BUILTIN.vocab)!.data, ex.data);
});

test("profile patch cannot escalate role", () => {
  const p = sanitizeProfilePatch({ role: "admin", displayName: "  Ana  ", dailyMinutes: 999 } as Partial<Profile>);
  assert.equal("role" in p, false);
  assert.equal(p.displayName, "Ana");
  assert.equal(p.dailyMinutes, 120);
});

test("tutor reply parser extracts correction, reply and alternatives (even mid-stream)", () => {
  const raw = "<correction>\noriginal: I have 25 years.\ncorrected: I am 25 years old.\nexplanation: Use 'be' for age.\n</correction>\nNice! Where are you from?\n<alternatives>\n- I'm 25.\n</alternatives>";
  const p = parseTutorReply(raw);
  assert.equal(p.correction?.corrected, "I am 25 years old.");
  assert.equal(p.reply, "Nice! Where are you from?");
  assert.deepEqual(p.alternatives, ["I'm 25."]);
  const partial = parseTutorReply("<correction>\noriginal: I has");
  assert.equal(partial.reply, "");
  assert.equal(parseTutorReply("Hello there <alterna").reply, "Hello there");
});
