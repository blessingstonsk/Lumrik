"use client";
import { Brain, Info, Target, TrendingUp } from "lucide-react";
import { MeterList, SimpleBarChart } from "@/components/charts";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { dueWords, lessonNodes, mistakeBreakdown, recommendNext, weakWords } from "@/lib/adaptive";
import { dayKey, lastNDays } from "@/lib/dates";
import { computeStats, levelFromXp } from "@/lib/gamification";
import { formatNumber } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  match_pairs: "Word matching",
  fill_blank: "Fill in the blank",
  listening: "Listening",
  speaking: "Speaking",
  sentence_builder: "Sentence builder",
  translate: "Translation / writing",
};

export default function ProgressPage() {
  const state = useLearnerState();
  const { course, vocabulary } = useLearner();
  const now = new Date();
  const today = dayKey(now, state.profile.timezone);
  const stats = computeStats(state, now);
  const days = lastNDays(today, 30);
  const series = days.map((d) => ({ label: d.slice(8), sub: d, value: state.activity[d]?.xp ?? 0 }));
  const activeDays = days.filter((d) => (state.activity[d]?.xp ?? 0) > 0).length;
  const breakdown = mistakeBreakdown(state);
  const weak = weakWords(state);
  const wordById = new Map(vocabulary.map((v) => [v.id, v]));
  const nodes = course ? lessonNodes(course, state) : [];
  const rec = recommendNext(course, state, now);
  const firstHalf = state.recentAttempts.slice(Math.floor(state.recentAttempts.length / 2));
  const secondHalf = state.recentAttempts.slice(0, Math.floor(state.recentAttempts.length / 2));
  const acc = (xs: typeof firstHalf) => (xs.length ? Math.round((xs.filter((a) => a.correct).length / xs.length) * 100) : null);
  const earlier = acc(firstHalf);
  const recent = acc(secondHalf);
  const level = levelFromXp(state.xpTotal);

  return (
    <div className="space-y-6">
      <PageHeader title="Progress analytics" subtitle="Everything here is calculated from your own activity." />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
        {[
          ["Total XP", formatNumber(state.xpTotal)],
          ["Level", level.level],
          ["Active days (30d)", activeDays],
          ["Longest streak", `${stats.longestStreak} days`],
          ["Lessons completed", stats.lessonsCompleted],
          ["Perfect lessons", stats.perfectLessons],
          ["Flashcard reviews", stats.reviews],
          ["Speaking drills", stats.speaking],
        ].map(([k, v]) => (
          <Card key={k as string} className="p-4">
            <p className="font-display text-2xl font-extrabold">{v}</p>
            <p className="text-xs font-semibold text-muted">{k}</p>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader title="XP over the last 30 days" icon={<TrendingUp className="h-5 w-5 text-primary" />} action={<Badge>{series.reduce((n, d) => n + d.value, 0)} XP</Badge>} />
        <SimpleBarChart data={series} unit="XP" title="XP per day, last 30 days" height={240} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Accuracy by exercise type" icon={<Target className="h-5 w-5 text-emerald-500" />} />
          {breakdown.length === 0 ? (
            <p className="text-sm text-muted">Complete a lesson to see your accuracy.</p>
          ) : (
            <>
              <MeterList items={breakdown.map((b) => ({ label: TYPE_LABEL[b.type] ?? b.type, value: b.accuracy, detail: `${b.total} answers` }))} />
              {earlier !== null && recent !== null && state.recentAttempts.length >= 20 && (
                <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                  Improvement: first-try accuracy went from <strong>{earlier}%</strong> to <strong>{recent}%</strong> across your last {state.recentAttempts.length} answers.
                </p>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Words that need work" icon={<Brain className="h-5 w-5 text-rose-500" />} action={weak.length ? <ButtonLink href="/lesson/review" size="sm">Review now</ButtonLink> : undefined} />
          {weak.length === 0 ? (
            <EmptyState icon="💪" title="No weak words" description="Words you miss repeatedly will show up here for extra practice." />
          ) : (
            <ul className="space-y-2">
              {weak
                .sort((a, b) => b.incorrect - a.incorrect)
                .slice(0, 8)
                .map((c) => {
                  const w = wordById.get(c.wordId);
                  return (
                    <li key={c.wordId} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
                      <span className="font-semibold">
                        {w?.emoji} {w?.term ?? c.wordId}
                      </span>
                      <span className="text-muted">
                        {c.incorrect} missed · {c.correct} right
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">{dueWords(state, now).length} words are due for spaced-repetition review.</p>
        </Card>
      </div>

      {course && (
        <Card>
          <CardHeader title="Lesson scores" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nodes
              .filter((n) => n.state === "completed")
              .map((n) => (
                <a key={n.id} href={`/lesson/${n.id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
                  <span className="truncate font-semibold">{n.title}</span>
                  <Badge tone={(n.bestScore ?? 0) >= 80 ? "success" : (n.bestScore ?? 0) >= 60 ? "warning" : "danger"}>{n.bestScore}%</Badge>
                </a>
              ))}
            {nodes.every((n) => n.state !== "completed") && <p className="text-sm text-muted">No completed lessons yet.</p>}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="How Lumrik personalises your learning" icon={<Info className="h-5 w-5 text-primary" />} />
        <p className="mb-3 text-sm">
          Right now we recommend: <strong>{rec.title}</strong> – {rec.reason}
        </p>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted">
          <li>Missed exercises come back once at the end of the same lesson.</li>
          <li>Each mistake lowers that word&apos;s ease and makes its flashcard due immediately.</li>
          <li>Words missed 2+ times (or ≥40% of the time) are marked weak; 5+ weak words → a personal review session is recommended first.</li>
          <li>15+ words due for review → a review is recommended before new lessons.</li>
          <li>Completed lessons with a best score under 60% are suggested for a retry.</li>
          <li>Your daily plan is sized to your {state.profile.dailyMinutes}-minute goal (about 5 minutes per lesson).</li>
        </ul>
      </Card>
    </div>
  );
}
