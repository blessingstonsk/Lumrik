import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN, ENGLISH_PLACEMENT } from "../../content/index";
import { checkAnswer } from "../validation";
import type { Exercise } from "../types";

/** The canonical correct answer for an exercise, serialized the way the lesson player sends it. */
export function canonicalAnswer(ex: Exercise): string {
  const d = ex.data;
  switch (d.type) {
    case "multiple_choice": return String(d.answer);
    case "listening": return d.mode === "choose" ? String(d.answer) : (d.accepted?.[0] ?? d.audioText);
    case "fill_blank": return d.answers[0];
    case "translate": return d.accepted[0];
    case "sentence_builder": return d.answer;
    case "speaking": return d.text;
    case "match_pairs": return JSON.stringify(d.pairs.map((_, i) => [i, i]));
  }
}

test("course has at least 20 lessons with 6+ exercises each", () => {
  assert.ok(BUILTIN.lessons.length >= 20, `only ${BUILTIN.lessons.length} lessons`);
  for (const l of BUILTIN.lessons) assert.ok(l.exercises.length >= 6, `${l.id} has ${l.exercises.length}`);
});

test("every authored exercise accepts its own canonical answer", () => {
  for (const l of BUILTIN.lessons)
    for (const ex of l.exercises) assert.ok(checkAnswer(ex, canonicalAnswer(ex)).correct, `${ex.id} rejects its own answer`);
});

test("choice exercises are well-formed", () => {
  for (const l of BUILTIN.lessons)
    for (const ex of l.exercises) {
      const d = ex.data;
      if (d.type === "multiple_choice") assert.ok(d.answer >= 0 && d.answer < d.choices.length, ex.id);
      if (d.type === "listening" && d.mode === "choose") assert.ok(d.answer! >= 0 && d.answer! < d.choices!.length, ex.id);
      if (d.type === "fill_blank") {
        assert.ok(d.sentence.includes("___"), ex.id);
        if (d.choices) assert.ok(d.choices.includes(d.answers[0]), `${ex.id} answer not in choices`);
      }
      if (d.type === "match_pairs") assert.equal(new Set(d.pairs.map((p) => p.right)).size, d.pairs.length, ex.id);
    }
});

test("wrong answers are rejected", () => {
  const ex = BUILTIN.lessons[0].exercises[0];
  assert.equal(checkAnswer(ex, "0").correct, false);
});

test("every lesson links vocabulary", () => {
  for (const l of BUILTIN.lessons) assert.ok(l.exercises.some((e) => e.wordIds.length > 0), `${l.id} has no linked words`);
  assert.ok(BUILTIN.vocab.length >= 100, `only ${BUILTIN.vocab.length} words`);
});

test("placement questions accept correct answers", () => {
  for (const q of ENGLISH_PLACEMENT) {
    const ex = { id: q.id, lessonId: "p", order: 0, instruction: "", data: q.data, explanation: "", wordIds: [] } as Exercise;
    assert.ok(checkAnswer(ex, canonicalAnswer(ex)).correct, q.id);
  }
});
