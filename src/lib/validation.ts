import type { Exercise, ExerciseCheck } from "./types";

/** Normalize free-text answers: case, punctuation, curly quotes, whitespace. */
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:"¡¿…()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, "i am"],
  [/\byou're\b/g, "you are"],
  [/\bwe're\b/g, "we are"],
  [/\bthey're\b/g, "they are"],
  [/\bhe's\b/g, "he is"],
  [/\bshe's\b/g, "she is"],
  [/\bit's\b/g, "it is"],
  [/\bthat's\b/g, "that is"],
  [/\bwhat's\b/g, "what is"],
  [/\bwhere's\b/g, "where is"],
  [/\bisn't\b/g, "is not"],
  [/\baren't\b/g, "are not"],
  [/\bdon't\b/g, "do not"],
  [/\bdoesn't\b/g, "does not"],
  [/\bcan't\b/g, "cannot"],
  [/\bcan not\b/g, "cannot"],
  [/\bi'd\b/g, "i would"],
  [/\blet's\b/g, "let us"],
];

/** Expand common English contractions so "I'm" and "I am" compare equal. */
export function canonical(text: string): string {
  let t = normalize(text);
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Compare a typed answer against accepted answers, allowing one small typo on longer answers. */
export function matchText(answer: string, accepted: string[]): { correct: boolean; typo: boolean } {
  const a = canonical(answer);
  if (!a) return { correct: false, typo: false };
  for (const acc of accepted) {
    if (canonical(acc) === a) return { correct: true, typo: false };
  }
  for (const acc of accepted) {
    const c = canonical(acc);
    const allowance = c.length >= 12 ? 2 : c.length >= 5 ? 1 : 0;
    if (allowance > 0 && levenshtein(a, c) <= allowance) return { correct: true, typo: true };
  }
  return { correct: false, typo: false };
}

/**
 * Validate a serialized learner answer for any exercise type.
 * Used by the lesson player for instant feedback AND re-run on the server before XP is awarded.
 *
 * Answer encodings:
 *  - multiple_choice / listening(choose): choice index as string
 *  - fill_blank / translate / listening(type): the text
 *  - sentence_builder: words joined with single spaces
 *  - match_pairs: JSON array of [leftIndex, rightIndex] pairs the learner matched
 *  - speaking: the speech-recognition transcript
 */
export function checkAnswer(ex: Exercise, answer: string): ExerciseCheck {
  const d = ex.data;
  switch (d.type) {
    case "multiple_choice":
      return { correct: Number(answer) === d.answer, expected: d.choices[d.answer] };
    case "listening": {
      if (d.mode === "choose") {
        const idx = d.answer ?? 0;
        return { correct: Number(answer) === idx, expected: d.choices?.[idx] ?? d.audioText };
      }
      const m = matchText(answer, d.accepted?.length ? d.accepted : [d.audioText]);
      return { ...m, expected: d.audioText };
    }
    case "fill_blank": {
      const m = d.choices ? { correct: d.answers.some((x) => canonical(x) === canonical(answer)), typo: false } : matchText(answer, d.answers);
      return { ...m, expected: d.sentence.replace("___", d.answers[0]) };
    }
    case "translate": {
      const m = matchText(answer, d.accepted);
      return { ...m, expected: d.accepted[0] };
    }
    case "sentence_builder": {
      const m = { correct: [d.answer, ...(d.accepted ?? [])].some((x) => canonical(x) === canonical(answer)), typo: false };
      return { ...m, expected: d.answer };
    }
    case "speaking": {
      const score = transcriptScore(d.text, answer).score;
      return { correct: score >= 0.8, expected: d.text };
    }
    case "match_pairs": {
      let pairs: [number, number][] = [];
      try {
        pairs = JSON.parse(answer);
      } catch {
        return { correct: false, expected: "" };
      }
      // Pairs are authored aligned (left i ↔ right i). A pair is correct when indexes are equal
      // OR when both sides have identical text (duplicate meanings).
      const ok =
        pairs.length === d.pairs.length &&
        pairs.every(([l, r]) => l === r || d.pairs[l]?.right === d.pairs[r]?.right);
      return { correct: ok, expected: d.pairs.map((p) => `${p.left} = ${p.right}`).join(", ") };
    }
  }
}

export interface WordDiff {
  word: string;
  status: "match" | "missing" | "extra";
}

/**
 * Transcription-based speaking feedback: align expected vs recognised words (LCS).
 * This measures whether the recogniser understood the words – NOT accent or phoneme accuracy.
 */
export function transcriptScore(expected: string, heard: string): { score: number; diff: WordDiff[] } {
  const e = canonical(expected).split(" ").filter(Boolean);
  const h = canonical(heard).split(" ").filter(Boolean);
  const dp: number[][] = Array.from({ length: e.length + 1 }, () => Array(h.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--)
    for (let j = h.length - 1; j >= 0; j--)
      dp[i][j] = e[i] === h[j] || levenshtein(e[i], h[j]) <= (e[i].length > 5 ? 1 : 0) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const diff: WordDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < e.length && j < h.length) {
    const same = e[i] === h[j] || levenshtein(e[i], h[j]) <= (e[i].length > 5 ? 1 : 0);
    if (same) {
      diff.push({ word: e[i], status: "match" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ word: e[i], status: "missing" });
      i++;
    } else {
      diff.push({ word: h[j], status: "extra" });
      j++;
    }
  }
  while (i < e.length) diff.push({ word: e[i++], status: "missing" });
  while (j < h.length) diff.push({ word: h[j++], status: "extra" });
  const matched = diff.filter((d) => d.status === "match").length;
  const extras = diff.filter((d) => d.status === "extra").length;
  const score = e.length === 0 ? 0 : Math.max(0, (matched - extras * 0.25) / e.length);
  return { score: Math.min(1, score), diff };
}
