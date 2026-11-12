import { NextResponse } from "next/server";
import { ActionError, runAction, type LearnerAction } from "@/lib/actions";
import { isSupabaseEnabled } from "@/lib/config";
import { applyWrites } from "@/lib/engine";
import { loadLearnerState, persistWrites, serverActionContext } from "@/lib/server/learner";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json({ error: "Supabase is not configured; the app is running in local mode." }, { status: 501 });
}

/** GET /api/learner – the signed-in learner's full progress state. */
export async function GET() {
  if (!isSupabaseEnabled) return notConfigured();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const state = await loadLearnerState(supabaseAdmin(), user.id);
    return NextResponse.json({ state });
  } catch (e) {
    console.error("[learner GET]", e);
    return NextResponse.json({ error: "Could not load your progress" }, { status: 500 });
  }
}

/**
 * POST /api/learner – perform a learner action. The server reloads trusted state,
 * re-validates answers against database content, computes XP and persists the result.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled) return notConfigured();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let action: LearnerAction;
  try {
    action = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = supabaseAdmin();
  try {
    const state = await loadLearnerState(db, user.id);
    if (action.type === "updateProfile") {
      for (const key of ["nativeLang", "targetLang"] as const) {
        const code = action.patch?.[key];
        if (code !== undefined) {
          const { count } = await db.from("languages").select("code", { count: "exact", head: true }).eq("code", code).eq("enabled", true);
          if (!count) return NextResponse.json({ error: `Unknown language: ${code}` }, { status: 400 });
        }
      }
    }
    const outcome = await runAction(state, action, serverActionContext(db, state.profile.targetLang));
    const reviewLog =
      action.type === "reviewCard"
        ? { wordId: action.wordId, grade: action.grade, interval: outcome.writes.vocab?.[0]?.interval ?? 0 }
        : undefined;
    await persistWrites(db, user.id, outcome.writes, { reviewLog });
    // Return writes so the client can update its in-memory state identically.
    const next = applyWrites(state, outcome.writes);
    return NextResponse.json({ result: outcome.result, writes: outcome.writes, xpTotal: next.xpTotal });
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[learner POST]", e);
    return NextResponse.json({ error: "Something went wrong saving your progress" }, { status: 500 });
  }
}
