"use client";
import { Bookmark, BookmarkCheck, Search } from "lucide-react";
import * as React from "react";
import { NoCourseNotice } from "@/components/app-shell";
import { SpeakButton } from "@/components/lesson/exercises";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { getLanguage } from "@/lib/languages";
import { isWeak, reviewStatus, type ReviewStatus } from "@/lib/srs";
import { cn } from "@/lib/utils";

type Filter = "all" | "learned" | "saved" | "weak";
const STATUS_TONE: Record<ReviewStatus, "neutral" | "primary" | "warning" | "success"> = { new: "neutral", learning: "warning", reviewing: "primary", mastered: "success" };

export default function VocabularyPage() {
  const state = useLearnerState();
  const { vocabulary, course, courseLoading, act } = useLearner();
  const toast = useToast();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("learned");
  const [pending, setPending] = React.useState<string | null>(null);
  const locale = getLanguage(state.profile.targetLang).speechLocale;

  if (courseLoading) return <PageSkeleton />;
  if (!course) return <NoCourseNotice />;

  const query = q.trim().toLowerCase();
  const words = vocabulary
    .filter((w) => {
      const c = state.vocab[w.id];
      if (filter === "learned" && !c?.learned) return false;
      if (filter === "saved" && !c?.saved) return false;
      if (filter === "weak" && !(c && isWeak(c))) return false;
      return !query || w.term.toLowerCase().includes(query) || w.meaning.toLowerCase().includes(query) || w.related.some((r) => r.toLowerCase().includes(query));
    })
    .sort((a, b) => a.term.localeCompare(b.term));

  const toggle = async (id: string, saved: boolean) => {
    setPending(id);
    try {
      await act({ type: "saveWord", wordId: id, saved });
    } catch (e) {
      toast({ title: "Couldn't update bookmark", description: (e as Error).message, tone: "error" });
    } finally {
      setPending(null);
    }
  };

  const counts = {
    learned: vocabulary.filter((w) => state.vocab[w.id]?.learned).length,
    saved: vocabulary.filter((w) => state.vocab[w.id]?.saved).length,
  };

  return (
    <div>
      <PageHeader
        title="Vocabulary notebook"
        subtitle={`${counts.learned} learned · ${counts.saved} bookmarked · ${vocabulary.length} words in the dictionary`}
        action={
          <ButtonLink href="/flashcards" size="sm">
            Practise flashcards
          </ButtonLink>
        }
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="Filter words"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "learned", label: "Learned" },
            { id: "saved", label: "Bookmarked" },
            { id: "weak", label: "Needs work" },
            { id: "all", label: "Dictionary" },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search words" placeholder="Search words or meanings…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      {words.length === 0 ? (
        <EmptyState
          icon="📖"
          title={query ? "No matching words" : filter === "learned" ? "No words learned yet" : filter === "saved" ? "Nothing bookmarked" : filter === "weak" ? "No weak words – nice!" : "Dictionary is empty"}
          description={filter === "learned" && !query ? "Words appear here as you practise them in lessons." : "Try another filter or search term."}
          action={filter === "learned" && !query ? <ButtonLink href="/learn">Start a lesson</ButtonLink> : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {words.map((w) => {
            const c = state.vocab[w.id];
            const status = reviewStatus(c);
            const saved = !!c?.saved;
            return (
              <li key={w.id}>
                <Card className="h-full">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                      {w.emoji ?? "🔤"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-extrabold" lang={state.profile.targetLang}>
                          {w.term}
                        </h2>
                        <span className="font-mono text-sm text-muted">{w.pronunciation}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge>{w.partOfSpeech}</Badge>
                        <Badge tone={STATUS_TONE[status]} className="capitalize">
                          {status}
                        </Badge>
                        {c && isWeak(c) && <Badge tone="danger">Needs work</Badge>}
                      </div>
                    </div>
                    <SpeakButton text={w.term} locale={locale} audioUrl={w.audioUrl} label={`Hear ${w.term}`} />
                    <button
                      type="button"
                      onClick={() => toggle(w.id, !saved)}
                      disabled={pending === w.id}
                      aria-pressed={saved}
                      aria-label={saved ? `Remove ${w.term} from bookmarks` : `Bookmark ${w.term}`}
                      className={cn("rounded-xl p-2 transition hover:bg-surface-2", saved ? "text-amber-500" : "text-muted")}
                    >
                      {saved ? <BookmarkCheck className="h-6 w-6" fill="currentColor" /> : <Bookmark className="h-6 w-6" />}
                    </button>
                  </div>
                  <p className="mt-3 font-semibold">{w.meaning}</p>
                  <p className="mt-1 text-sm italic text-muted">&ldquo;{w.example}&rdquo;</p>
                  {w.related.length > 0 && (
                    <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold text-muted">Related:</span>
                      {w.related.map((r) => (
                        <button key={r} type="button" onClick={() => { setQ(r); setFilter("all"); }} className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold hover:bg-indigo-500/10 hover:text-primary">
                          {r}
                        </button>
                      ))}
                    </p>
                  )}
                  {c && c.learned && (
                    <p className="mt-3 text-xs text-muted">
                      Reviewed {c.reps}× · {c.correct} right / {c.incorrect} wrong · next review {new Date(c.due) <= new Date() ? "now" : new Date(c.due).toLocaleDateString()}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
