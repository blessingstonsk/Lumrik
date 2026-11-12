import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODEL, FALLBACK_BETA, anthropic, guardAiRequest, languageName } from "@/lib/server/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  prompt: z.string().min(1).max(300),
  text: z.string().min(1).max(1500),
  targetLang: z.string().min(2).max(10),
  nativeLang: z.string().min(2).max(10),
  level: z.enum(["easy", "medium", "hard"]),
});

export interface WritingFeedback {
  score: number;
  corrected: string;
  issues: { original: string; suggestion: string; explanation: string }[];
  strengths: string[];
  encouragement: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "corrected", "issues", "strengths", "encouragement"],
  properties: {
    score: { type: "integer", description: "0-100 overall quality for the learner's level" },
    corrected: { type: "string", description: "The full text rewritten correctly, keeping the learner's meaning and level" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "suggestion", "explanation"],
        properties: { original: { type: "string" }, suggestion: { type: "string" }, explanation: { type: "string" } },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    encouragement: { type: "string" },
  },
};

export async function POST(req: Request) {
  const guard = await guardAiRequest(req, "writing", 20);
  if ("error" in guard) return guard.error;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Please write between 1 and 1500 characters." }, { status: 400 });
  }
  const target = languageName(body.targetLang);
  const native = languageName(body.nativeLang);
  try {
    const msg = await anthropic()!.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: `You are a supportive ${target} writing teacher. Evaluate a learner's short text for a ${body.level} (${body.level === "easy" ? "A1–A2" : body.level === "medium" ? "B1–B2" : "C1"}) learner whose native language is ${native}.
List up to 6 of the most important real issues (grammar, word choice, spelling) – never invent errors; if the text is correct, return an empty issues list.
Write explanations, strengths and encouragement in ${native} so the learner understands them; keep "original", "suggestion" and "corrected" in ${target}. Be concise and kind.`,
      messages: [{ role: "user", content: `Writing task: ${body.prompt}\n\nLearner's text:\n"""${body.text}"""` }],
    });
    if (msg.stop_reason === "refusal") return NextResponse.json({ error: "This text can't be reviewed. Please try a different topic." }, { status: 422 });
    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No feedback returned");
    const feedback = JSON.parse(text.text) as WritingFeedback;
    feedback.score = Math.max(0, Math.min(100, Math.round(feedback.score)));
    return NextResponse.json({ feedback });
  } catch (e) {
    console.error("[writing]", e);
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy right now. Try again in a minute." }, { status: 429 });
    return NextResponse.json({ error: "Couldn't get feedback right now. Please try again." }, { status: 502 });
  }
}
