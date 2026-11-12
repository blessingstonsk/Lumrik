"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lightbulb, Mic, Plus, Send, Sparkles, Square, Wand2 } from "lucide-react";
import * as React from "react";
import { SpeakButton } from "@/components/lesson/exercises";
import { useAuth } from "@/components/providers/auth";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, PageHeader, Tabs } from "@/components/ui/misc";
import { appendMessages, createConversation, latestConversation, type Conversation } from "@/lib/data/tutor-history";
import { fontClassFor, getLanguage } from "@/lib/languages";
import { useRecognizer } from "@/lib/speech";
import { parseTutorReply, SCENARIOS, type TutorLevel, type TutorMessage } from "@/lib/tutor";
import { cn } from "@/lib/utils";
import type { WritingFeedback } from "@/app/api/writing/route";

const LEVEL_FOR: Record<string, TutorLevel> = { beginner: "easy", elementary: "easy", intermediate: "medium", advanced: "hard" };

function AssistantBubble({ raw, locale, lang, streaming }: { raw: string; locale: string; lang: string; streaming?: boolean }) {
  const p = parseTutorReply(raw);
  return (
    <div className="max-w-[85%] space-y-2">
      {p.correction && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-700 dark:text-amber-300">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Correction
          </p>
          <p className="mt-1">
            <span className="rounded bg-rose-500/10 px-1 line-through decoration-rose-500/60">{p.correction.original}</span>
          </p>
          <p className="mt-1 flex items-start gap-1">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            <span className="font-semibold">{p.correction.corrected}</span>
          </p>
          {p.correction.explanation && <p className="mt-1 text-muted">{p.correction.explanation}</p>}
        </div>
      )}
      {p.reply && (
        <div className="flex items-start gap-2">
          <div className={cn("rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-2.5 whitespace-pre-wrap", fontClassFor(lang))} lang={lang}>
            {p.reply}
            {streaming && <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded bg-primary align-middle" aria-hidden />}
          </div>
          {!streaming && <SpeakButton text={p.reply} locale={locale} label="Listen to reply" />}
        </div>
      )}
      {p.alternatives.length > 0 && !streaming && (
        <div className="rounded-2xl border border-dashed border-border p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted">
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> Other ways to say it
          </p>
          <ul className="mt-1 list-inside list-disc">
            {p.alternatives.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Conversation() {
  const state = useLearnerState();
  const { act } = useLearner();
  const { user } = useAuth();
  const target = state.profile.targetLang;
  const lang = getLanguage(target);
  const [scenario, setScenario] = React.useState("free");
  const [level, setLevel] = React.useState<TutorLevel>(LEVEL_FOR[state.profile.proficiency] ?? "easy");
  const [explainNative, setExplainNative] = React.useState(state.profile.nativeLang !== target);
  const [conv, setConv] = React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<TutorMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streamingText, setStreamingText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const endRef = React.useRef<HTMLDivElement>(null);
  const rec = useRecognizer(lang.speechLocale);
  const scen = SCENARIOS.find((s) => s.id === scenario)!;

  React.useEffect(() => {
    if (!user) return;
    setHistoryLoading(true);
    latestConversation(user.id, scenario, target)
      .then((c) => {
        setConv(c);
        setMessages(c?.messages ?? []);
      })
      .catch(() => setMessages([]))
      .finally(() => setHistoryLoading(false));
  }, [user, scenario, target]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streamingText !== null || !user) return;
    setError(null);
    setInput("");
    const history: TutorMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setStreamingText("");
    let reply = "";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-30), scenario, level, targetLang: target, nativeLang: state.profile.nativeLang, explainInNative: explainNative }),
      });
      if (!res.ok || !res.body) {
        const b = await res.json().catch(() => ({}));
        if (b.code === "not_configured") setNotConfigured(true);
        throw new Error(b.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += dec.decode(value, { stream: true });
        setStreamingText(reply.replace(/\n*\[\[error:[\s\S]*$/, ""));
      }
      const err = reply.match(/\[\[error:([\s\S]*?)\]\]/);
      if (err) {
        reply = reply.replace(/\n*\[\[error:[\s\S]*$/, "").trim();
        setError(err[1]);
      }
      if (reply.trim()) {
        const all: TutorMessage[] = [...history, { role: "assistant", content: reply }];
        setMessages(all);
        // Persist and award practice XP (capped per day on the server).
        try {
          const c = conv ?? (await createConversation(user.id, scenario, target, level));
          if (!conv) setConv(c);
          await appendMessages(user.id, c.id, [{ role: "user", content }, { role: "assistant", content: reply }]);
          await act({ type: "practice", kind: "tutor" });
        } catch (e) {
          console.warn("Could not save conversation", e);
        }
      } else {
        setMessages(history.slice(0, -1));
        setInput(content);
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages(history.slice(0, -1));
      setInput(content);
    } finally {
      setStreamingText(null);
    }
  };

  const newConversation = () => {
    setConv(null);
    setMessages([]);
    setError(null);
  };

  const dictate = async () => {
    const t = await rec.start();
    if (t) setInput((v) => (v ? v + " " : "") + t);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold">Scenario</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1" role="radiogroup" aria-label="Conversation scenario">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={scenario === s.id}
                onClick={() => setScenario(s.id)}
                className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition", scenario === s.id ? "bg-indigo-500/10 text-primary" : "hover:bg-surface-2")}
              >
                <span aria-hidden>{s.icon}</span> {s.title}
              </button>
            ))}
          </div>
        </Card>
        <Card className="space-y-4 p-4">
          <div>
            <label htmlFor="difficulty" className="mb-1.5 block text-sm font-bold">
              Difficulty
            </label>
            <Select id="difficulty" value={level} onChange={(e) => setLevel(e.target.value as TutorLevel)}>
              <option value="easy">Easy (A1–A2)</option>
              <option value="medium">Medium (B1–B2)</option>
              <option value="hard">Hard (C1)</option>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="explain-native" className="text-sm font-semibold">
              Explain in {getLanguage(state.profile.nativeLang).name}
            </label>
            <Switch id="explain-native" checked={explainNative} onChange={setExplainNative} label={`Explain mistakes in ${getLanguage(state.profile.nativeLang).name}`} />
          </div>
          <Button variant="outline" size="sm" block onClick={newConversation}>
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </Card>
      </aside>

      <Card className="flex h-[min(70dvh,44rem)] flex-col p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <span className="text-2xl" aria-hidden>{scen.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{scen.title}</p>
            <p className="truncate text-xs text-muted">
              Practising {lang.name} · {level}
            </p>
          </div>
          <Badge tone="primary">
            <Sparkles className="h-3 w-3" /> AI
          </Badge>
        </div>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite" aria-busy={streamingText !== null}>
          {notConfigured ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <div className="text-4xl">🔌</div>
              <h3 className="mt-2 font-display text-lg font-bold">AI tutor not connected</h3>
              <p className="mt-1 text-sm text-muted">
                The server has no <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code>. Add it to <code className="rounded bg-surface-2 px-1">.env.local</code> and restart the server – the key stays on the server and is never sent to the browser.
              </p>
            </div>
          ) : historyLoading ? (
            <p className="py-8 text-center text-sm text-muted">Loading conversation…</p>
          ) : messages.length === 0 && streamingText === null ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <div className="text-5xl">{scen.icon}</div>
              <h3 className="mt-3 font-display text-lg font-bold">{scen.title}</h3>
              <p className="mt-1 text-sm text-muted">Write (or say) anything in {lang.name}. Your tutor will reply in character and gently correct mistakes.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => send(scen.opener)}>
                Try: &ldquo;{scen.opener}&rdquo;
              </Button>
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className={cn("max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-white whitespace-pre-wrap", fontClassFor(target))} lang={target}>
                    {m.content}
                  </div>
                ) : (
                  <AssistantBubble raw={m.content} locale={lang.speechLocale} lang={target} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {streamingText !== null && (
            <div className="flex justify-start">
              {streamingText ? (
                <AssistantBubble raw={streamingText} locale={lang.speechLocale} lang={target} streaming />
              ) : (
                <div className="rounded-2xl bg-surface-2 px-4 py-3" aria-label="Tutor is typing">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-2 w-2 rounded-full bg-muted" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                    ))}
                  </span>
                </div>
              )}
            </div>
          )}
          {error && <ErrorState message={error} />}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          {rec.supported && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={rec.status === "listening" ? rec.stop : dictate}
              aria-label={rec.status === "listening" ? "Stop dictation" : "Dictate message"}
            >
              {rec.status === "listening" ? <Square className="h-5 w-5 text-rose-500" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Textarea
            aria-label={`Message in ${lang.name}`}
            placeholder={rec.status === "listening" ? "Listening…" : `Write in ${lang.name}…`}
            value={rec.status === "listening" ? rec.transcript || input : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            className={cn("min-h-11 resize-none py-2.5", fontClassFor(target))}
            lang={target}
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!input.trim() || streamingText !== null || notConfigured} aria-label="Send message">
            <Send className="h-5 w-5" />
          </Button>
        </form>
        {rec.error && <p className="px-4 pb-2 text-xs text-rose-500">{rec.error}</p>}
      </Card>
    </div>
  );
}

const WRITING_PROMPTS = [
  "Introduce yourself: your name, where you are from and what you do.",
  "Describe your family.",
  "Write about your favourite food and why you like it.",
  "Describe a normal day in your life.",
  "Write a short message inviting a friend to the cinema.",
  "Describe your home.",
];

function Writing() {
  const state = useLearnerState();
  const { act } = useLearner();
  const target = state.profile.targetLang;
  const [prompt, setPrompt] = React.useState(WRITING_PROMPTS[0]);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fb, setFb] = React.useState<WritingFeedback | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setFb(null);
    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, text, targetLang: target, nativeLang: state.profile.nativeLang, level: LEVEL_FOR[state.profile.proficiency] ?? "easy" }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? "Request failed");
      setFb(b.feedback);
      await act({ type: "practice", kind: "writing" }).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <label htmlFor="prompt" className="mb-1.5 block text-sm font-bold">
          Writing task
        </label>
        <Select id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}>
          {WRITING_PROMPTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <label htmlFor="writing" className="mb-1.5 mt-4 block text-sm font-bold">
          Your text in {getLanguage(target).name}
        </label>
        <Textarea id="writing" value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={1500} className={fontClassFor(target)} lang={target} placeholder="Write 3–6 sentences…" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{text.length}/1500</span>
          <Button onClick={submit} loading={loading} disabled={text.trim().length < 3}>
            <Sparkles className="h-4 w-4" /> Get AI feedback
          </Button>
        </div>
      </Card>
      <div>
        {error && <ErrorState message={error} onRetry={submit} />}
        {!fb && !error && (
          <Card className="flex h-full flex-col items-center justify-center text-center text-sm text-muted">
            <div className="text-4xl">✍️</div>
            <p className="mt-2 max-w-xs">Write a short text and get corrections, explanations and a polished version from your AI tutor.</p>
          </Card>
        )}
        {fb && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Feedback</h2>
              <Badge tone={fb.score >= 80 ? "success" : fb.score >= 50 ? "warning" : "danger"}>{fb.score}/100</Badge>
            </div>
            {fb.issues.length === 0 ? (
              <p className="rounded-xl bg-emerald-500/10 p-3 text-sm">No mistakes found – excellent!</p>
            ) : (
              <ul className="space-y-2">
                {fb.issues.map((i, k) => (
                  <li key={k} className="rounded-xl bg-surface-2 p-3 text-sm">
                    <span className="rounded bg-rose-500/10 px-1 line-through">{i.original}</span> → <strong>{i.suggestion}</strong>
                    <p className="mt-1 text-muted">{i.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="text-xs font-bold uppercase text-muted">Improved version</p>
              <p className={cn("mt-1 rounded-xl border border-border p-3", fontClassFor(target))} lang={target}>
                {fb.corrected}
              </p>
            </div>
            {fb.strengths.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase text-muted">What you did well</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {fb.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm font-semibold text-primary">{fb.encouragement}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function TutorPage() {
  const [tab, setTab] = React.useState<"chat" | "writing">("chat");
  return (
    <div>
      <PageHeader title="AI tutor" subtitle="Practise real conversations and get feedback on your writing." action={<Tabs label="Tutor mode" value={tab} onChange={setTab} tabs={[{ id: "chat", label: "Conversation" }, { id: "writing", label: "Writing practice" }]} />} />
      {tab === "chat" ? <Conversation /> : <Writing />}
    </div>
  );
}
