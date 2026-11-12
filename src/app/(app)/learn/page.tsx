"use client";
import { motion } from "framer-motion";
import { Check, Lock, Play, Star } from "lucide-react";
import Link from "next/link";
import { NoCourseNotice } from "@/components/app-shell";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { ButtonLink } from "@/components/ui/button";
import { Badge, PageHeader, PageSkeleton, ProgressBar } from "@/components/ui/misc";
import { lessonNodes, recommendNext } from "@/lib/adaptive";
import { cn } from "@/lib/utils";

const OFFSETS = [0, 48, 72, 48, 0, -48, -72, -48];

const LEVEL_TRACKS = [
  { cefr: "A1–A2", name: "Beginner", topics: "Alphabet, greetings, numbers, common words, everyday conversations, basic grammar" },
  { cefr: "B1–B2", name: "Intermediate", topics: "Complex sentences, discussions, reading & listening comprehension, practical communication" },
  { cefr: "C1–C2", name: "Advanced", topics: "Advanced vocabulary, professional conversations, idioms, complex texts, writing & speaking" },
];

export default function LearnPage() {
  const state = useLearnerState();
  const { course, courseLoading } = useLearner();
  if (courseLoading) return <PageSkeleton />;
  if (!course) return <NoCourseNotice />;

  const nodes = lessonNodes(course, state);
  const rec = recommendNext(course, state);
  const done = nodes.filter((n) => n.state === "completed").length;

  return (
    <div>
      <PageHeader
        title="Learning path"
        subtitle={`${course.title} · ${done}/${nodes.length} lessons complete`}
        action={
          done === 0 ? (
            <ButtonLink href="/placement" variant="outline" size="sm">
              Take placement test
            </ButtonLink>
          ) : undefined
        }
      />
      <ProgressBar value={nodes.length ? done / nodes.length : 0} color="bg-secondary" label="Course progress" className="mb-8" />

      <div className="space-y-10">
        {course.units.map((unit) => {
          const unitNodes = nodes.filter((n) => n.unitId === unit.id);
          const unitDone = unitNodes.filter((n) => n.state === "completed").length;
          return (
            <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
              <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-indigo-500 to-indigo-400 p-5 text-white shadow-md">
                <span className="text-4xl" aria-hidden>
                  {unit.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">
                    Unit {unit.order} · CEFR {unit.cefr}
                  </p>
                  <h2 id={`unit-${unit.id}`} className="font-display text-xl font-extrabold">
                    {unit.title}
                  </h2>
                  <p className="text-sm text-indigo-100">{unit.description}</p>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
                  {unitDone}/{unitNodes.length}
                </span>
              </div>

              <ol className="mt-6 flex flex-col items-center gap-5">
                {unitNodes.map((n, i) => {
                  const isNext = n.id === rec.lessonId;
                  const offset = OFFSETS[i % OFFSETS.length];
                  const inner = (
                    <>
                      <span
                        className={cn(
                          "relative flex h-18 w-18 items-center justify-center rounded-full border-b-[6px] text-white transition",
                          n.state === "completed" && "border-amber-600 bg-amber-400",
                          n.state === "available" && "border-indigo-700 bg-primary group-hover:brightness-110",
                          n.state === "locked" && "border-slate-400 bg-slate-300 text-slate-500 dark:border-slate-700 dark:bg-slate-600 dark:text-slate-400",
                        )}
                      >
                        {n.state === "completed" ? (
                          (n.bestScore ?? 0) === 100 ? <Star className="h-8 w-8" fill="currentColor" aria-hidden /> : <Check className="h-8 w-8" strokeWidth={3} aria-hidden />
                        ) : n.state === "locked" ? (
                          <Lock className="h-7 w-7" aria-hidden />
                        ) : (
                          <Play className="h-8 w-8" fill="currentColor" aria-hidden />
                        )}
                        {isNext && (
                          <motion.span
                            className="absolute -inset-2 rounded-full border-4 border-primary/40"
                            animate={{ scale: [1, 1.12, 1], opacity: [0.8, 0.3, 0.8] }}
                            transition={{ repeat: Infinity, duration: 1.8 }}
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="mt-2 block max-w-40 text-center">
                        <span className="block text-sm font-bold">{n.title}</span>
                        <span className="block text-xs text-muted">
                          {n.state === "completed" ? `Best ${n.bestScore}% · practise again` : n.state === "locked" ? "Locked" : `${n.exerciseCount} exercises`}
                        </span>
                        {isNext && <Badge tone="primary" className="mt-1">Start here</Badge>}
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id} style={{ transform: `translateX(${offset}px)` }}>
                      {n.state === "locked" ? (
                        <div className="flex flex-col items-center opacity-80" aria-label={`${n.title} (locked – complete the previous lesson first)`}>
                          {inner}
                        </div>
                      ) : (
                        <Link href={`/lesson/${n.id}`} className="group flex flex-col items-center" aria-label={`${n.title}: ${n.state === "completed" ? `completed, best score ${n.bestScore}%` : "start lesson"}`}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <section className="mt-14" aria-labelledby="levels">
        <h2 id="levels" className="mb-4 font-display text-xl font-extrabold">
          The road ahead
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {LEVEL_TRACKS.map((t, i) => (
            <div key={t.cefr} className={cn("rounded-2xl border-2 p-5", i === 0 ? "border-primary bg-indigo-500/5" : "border-dashed border-border")}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold">{t.name}</span>
                <Badge tone={i === 0 ? "primary" : "neutral"}>{t.cefr}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{t.topics}</p>
              <p className="mt-3 text-xs font-semibold">{i === 0 ? "✅ Available now" : "🛠️ In authoring – added via the content manager"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
