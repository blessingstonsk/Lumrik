import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "../config";
import { getLanguage } from "../languages";
import { currentUser } from "../supabase/server";

// ── Providers ────────────────────────────────────────────────
// Lumrik supports two AI providers. Set ONE key on the server:
//   ANTHROPIC_API_KEY – Claude (paid, best quality)
//   GEMINI_API_KEY    – Google Gemini (has a free tier)
// If both are set, Claude is used unless AI_PROVIDER=gemini.

export type AiProvider = "anthropic" | "gemini";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
/** Server-side refusal fallback (routes a declined request to a suitable model automatically). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;
/** Free-tier, fast Gemini model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const hasAnthropicKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini" && geminiKey()) return "gemini";
  if (forced === "anthropic" && hasAnthropicKey()) return "anthropic";
  if (hasAnthropicKey()) return "anthropic";
  if (geminiKey()) return "gemini";
  return null;
}

let anthropicClient: Anthropic | null = null;
export function anthropic(): Anthropic | null {
  if (!hasAnthropicKey()) return null;
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

let geminiClient: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI | null {
  if (!geminiKey()) return null;
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: geminiKey() });
  return geminiClient;
}

/** Turn a provider error into a short, learner-friendly message. */
export function friendlyAiError(e: unknown): { message: string; status: number } {
  if (e instanceof Anthropic.RateLimitError) return { message: "The AI tutor is busy right now. Please try again in a minute.", status: 429 };
  if (e instanceof Anthropic.AuthenticationError) return { message: "The AI tutor's API key is invalid. Ask the administrator to check ANTHROPIC_API_KEY.", status: 502 };
  if (e instanceof Anthropic.APIConnectionError) return { message: "Couldn't reach the AI service. Check your connection and try again.", status: 502 };
  if (e instanceof GeminiApiError) {
    if (e.status === 429) return { message: "The free Gemini limit was reached for now. Please wait a minute (or until tomorrow) and try again.", status: 429 };
    if (e.status === 400 && /api key/i.test(e.message)) return { message: "The Gemini API key is invalid. Ask the administrator to check GEMINI_API_KEY.", status: 502 };
    if (e.status === 401 || e.status === 403) return { message: "The Gemini API key is invalid or not allowed. Ask the administrator to check GEMINI_API_KEY.", status: 502 };
    if (e.status === 404) return { message: `The Gemini model "${GEMINI_MODEL}" isn't available. Set GEMINI_MODEL to a current model.`, status: 502 };
  }
  return { message: "The AI tutor ran into a problem. Please try again.", status: 502 };
}

// ── Simple in-memory rate limit (per instance). Use a shared store (e.g. Redis) in multi-instance deployments.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Authenticate (Supabase mode) and rate-limit an AI request. Returns an error response, or the caller key and provider. */
export async function guardAiRequest(req: Request, scope: string, limit = 40): Promise<{ error: NextResponse } | { key: string; provider: AiProvider }> {
  const provider = aiProvider();
  if (!provider)
    return {
      error: NextResponse.json(
        { error: "The AI tutor isn't configured yet. Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to your server environment (see README).", code: "not_configured" },
        { status: 503 },
      ),
    };
  let key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isSupabaseEnabled) {
    const user = await currentUser();
    if (!user) return { error: NextResponse.json({ error: "Please sign in to use the AI tutor." }, { status: 401 }) };
    key = user.id;
  }
  if (!rateLimit(`${scope}:${key}`, limit, 10 * 60_000))
    return { error: NextResponse.json({ error: "You're sending messages very quickly. Take a short break and try again in a few minutes." }, { status: 429 }) };
  return { key, provider };
}

export function languageName(code: string) {
  return getLanguage(code).name;
}

const SCRIPT_CLASSES: Record<string, string[]> = {
  Latin: ["Latin"],
  Tamil: ["Tamil"],
  Devanagari: ["Devanagari"],
  Malayalam: ["Malayalam"],
  Telugu: ["Telugu"],
  Kannada: ["Kannada"],
  Japanese: ["Han", "Hiragana", "Katakana"],
  Hangul: ["Hangul"],
};

/**
 * Small models occasionally slip stray characters from unrelated writing systems into
 * their output (e.g. a Chinese character inside a Tamil sentence). This returns a filter
 * that removes letters whose script is neither Latin nor one of the given languages' scripts.
 */
export function scriptFilter(...codes: string[]) {
  const scripts = new Set<string>(["Latin", "Common", "Inherited"]);
  for (const c of codes) for (const s of SCRIPT_CLASSES[getLanguage(c).script] ?? []) scripts.add(s);
  const allowed = [...scripts].map((s) => String.raw`\p{Script=${s}}`).join("");
  const re = new RegExp(String.raw`(?![${allowed}])[\p{L}\p{M}]`, "gu");
  return (text: string) => text.replace(re, "");
}

/**
 * Name of a language plus a script rule for prompts. Models sometimes write Indic or
 * East-Asian languages in Latin letters (e.g. "Tanglish"); this asks for the native script.
 */
export function languageWithScript(code: string) {
  const l = getLanguage(code);
  if (l.script === "Latin") return l.name;
  return `${l.name} (written in the ${l.script} script, like "${l.nativeName}" – never transliterated into English/Latin letters)`;
}
