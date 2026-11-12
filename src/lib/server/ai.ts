import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "../config";
import { getLanguage } from "../languages";
import { currentUser } from "../supabase/server";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
/** Server-side refusal fallback (routes a declined request to a suitable model automatically). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

let client: Anthropic | null = null;
export function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  if (!client) client = new Anthropic();
  return client;
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

/** Authenticate (Supabase mode) and rate-limit an AI request. Returns an error response or the caller key. */
export async function guardAiRequest(req: Request, scope: string, limit = 40): Promise<{ error: NextResponse } | { key: string }> {
  if (!anthropic())
    return {
      error: NextResponse.json(
        { error: "The AI tutor isn't configured yet. Add ANTHROPIC_API_KEY to your server environment (see README).", code: "not_configured" },
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
  return { key };
}

export function languageName(code: string) {
  return getLanguage(code).name;
}
