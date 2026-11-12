"use client";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CalendarCheck, Flame, Gift, GraduationCap, Info, Layers, Sparkles, Target, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { NoCourseNotice } from "@/components/app-shell";
import { SimpleBarChart } from "@/components/charts";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar, ProgressRing } from "@/components/ui/misc";
import { dailyPlan, dueWords, lessonNodes, recommendNext } from "@/lib/adaptive";
import { dayKey, lastNDays, weekdayShort } from "@/lib/dates";
import { ACHIEVEMENTS, computeStats, dailyMissions, levelFromXp, weeklyChallenge, XP } from "@/lib/gamification";
import { getLanguage } from "@/lib/languages";
import { cn, formatNumber } from "@/lib/utils";

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>{icon}</div>
      <div className="min-w-0">
        <p className="font-display text-xl font-extrabold leading-tight">{value}</p>
        <p className="truncate text-xs font-semibold text-muted">{label}</p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const state = useLearnerState();
  const { course, courseLoading, act } = useLearner();
  const toast = useToast();
  const [claiming, setClaiming] = React.useState(false);
  const now = new Date();
  const today = dayKey(now, state.profile.timezone);
  const stats = computeStats(state, now);
  const todayXp = state.activity[today]?.xp ?? 0;
  const level = levelFromXp(state.xpTotal);
  const rec = recommendNext(course, state, now);
  const plan = dailyPlan(course, state, now);
  const missions = dailyMissions(state, now);
  const weekly = weeklyChallenge(state, now);
  const allDone = missions.every((m) => m.progress >= m.target);
  const claimed = state.activity[today]?.missionsClaimed ?? false;
  const nodes = course ? lessonNodes(course, state) : [];
  const currentNode = nodes.find((n) => n.id === rec.lessonId) ?? nodes.find((n) => n.state === "available");
  const currentUnit = course?.units.find((u) => u.order === currentNode?.unitOrder);
  const week = lastNDays(today, 7).map((d) => ({ label: weekdayShort(d), sub: d, value: state.activity[d]?.xp ?? 0 }));
  const due = dueWords(state, now).length;
  const recent = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).sort((a, b) => state.achievements[b.id].localeCompare(state.achievements[a.id])).slice(0, 3);
  const nextAch = ACHIEVEMENTS.filter((a) => !state.achievements[a.id]).map((a) => ({ a, p: Math.min(1, stats[a.metric] / a.target) })).sort((x, y) => y.p - x.p)[0];
  const lang = getLanguage(state.profile.targetLang);

  const claim = async () => {
    setClaiming(true);
    try {
      await act({ type: "claimMissions" });
      toast({ title: `+${XP.missionsBonus} XP bonus!`, description: "All daily missions complete.", icon: "🎁", tone: "success" });
    } catch (e) {
      toast({ title: "Couldn't claim reward", description: (e as Error).message, tone: "error" });
    } finally {
      setClaiming(false);
    }
  };

  const continueHref = rec.lessonId ? `/lesson/${rec.lessonId}` : rec.kind === "review" ? "/lesson/review" : "/tutor";

  return (
    <div className="space-y-6">
      {/* Continue learning hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-500 p-6 text-white shadow-lg sm:p-8"
      >
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
            <span aria-hidden>{lang.flag}</span> {course?.title ?? `Learning ${lang.name}`}
            {currentUnit && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{currentUnit.cefr} · Unit {currentUnit.order}</span>}
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{rec.title}</h1>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-indigo-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">Why this: </span>
              {rec.reason}
            </span>
          </p>
          <ButtonLink href={continueHref} variant="accent" size="lg" className="mt-5">
            Continue learning <ArrowRight className="h-5 w-5" aria-hidden />
          </ButtonLink>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-emerald-400/20" aria-hidden />
        <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-8xl sm:block" aria-hidden>
          {currentUnit?.icon ?? "🎯"}
        </div>
      </motion.section>

      {!courseLoading && !course && <NoCourseNotice />}

      {/* Key stats */}
      <section aria-label="Your stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Flame className="h-6 w-6" />} tone="bg-orange-500/10 text-orange-500" label="Day streak" value={stats.streak} sub={`Best: ${stats.longestStreak}`} />
        <Stat icon={<Zap className="h-6 w-6" />} tone="bg-amber-500/10 text-amber-500" label="Total XP" value={formatNumber(state.xpTotal)} sub={`Level ${level.level}`} />
        <Stat icon={<BookOpen className="h-6 w-6" />} tone="bg-indigo-500/10 text-indigo-500" label="Lessons completed" value={`${stats.lessonsCompleted}${nodes.length ? `/${nodes.length}` : ""}`} />
        <Stat icon={<Layers className="h-6 w-6" />} tone="bg-emerald-500/10 text-emerald-500" label="Words learned" value={stats.wordsLearned} sub={due ? `${due} due for review` : "All caught up"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily goal */}
        <Card className="flex flex-col items-center text-center">
          <CardHeader title="Daily goal" icon={<Target className="h-5 w-5 text-primary" />} className="w-full" />
          <ProgressRing value={todayXp / state.profile.dailyXpGoal} size={140} stroke={14} color={todayXp >= state.profile.dailyXpGoal ? "#10B981" : "#6366F1"} label={`${todayXp} of ${state.profile.dailyXpGoal} XP today`}>
            <span className="font-display text-3xl font-extrabold">{todayXp}</span>
            <span className="text-xs font-semibold text-muted">/ {state.profile.dailyXpGoal} XP</span>
          </ProgressRing>
          <p className="mt-4 text-sm text-muted">{todayXp >= state.profile.dailyXpGoal ? "🎉 Goal reached – amazing work today!" : `${state.profile.dailyXpGoal - todayXp} XP to go · ${state.profile.dailyMinutes} min/day plan`}</p>
          <div className="mt-4 w-full rounded-2xl bg-surface-2 p-3 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" /> Level {level.level}
              </span>
              <span className="text-xs text-muted">
                {level.intoLevel}/{level.needed} XP
              </span>
            </div>
            <ProgressBar value={level.progress} className="mt-2 h-2" color="bg-amber-400" label="Level progress" />
            <p className="mt-2 text-xs text-muted">
              Proficiency: <strong className="capitalize text-fg">{state.profile.proficiency}</strong>
              {currentUnit && ` · working at CEFR ${currentUnit.cefr}`}
            </p>
          </div>
        </Card>

        {/* Weekly activity */}
        <Card className="lg:col-span-2">
          <CardHeader title="Weekly activity" icon={<CalendarCheck className="h-5 w-5 text-primary" />} action={<Badge>{week.reduce((n, d) => n + d.value, 0)} XP this week</Badge>} />
          <SimpleBarChart data={week} unit="XP" title="XP earned per day, last 7 days" height={220} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily missions */}
        <Card>
          <CardHeader title="Daily missions" icon={<Sparkles className="h-5 w-5 text-amber-500" />} />
          <ul className="space-y-4">
            {missions.map((m) => (
              <li key={m.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    <span aria-hidden>{m.icon}</span> {m.title}
                  </span>
                  <span className="text-xs font-bold text-muted">
                    {Math.min(m.progress, m.target)}/{m.target}
                  </span>
                </div>
                <ProgressBar value={m.progress / m.target} className="h-2" color={m.progress >= m.target ? "bg-secondary" : "bg-amber-400"} label={m.title} />
              </li>
            ))}
          </ul>
          <Button className="mt-5" block variant={allDone && !claimed ? "accent" : "outline"} disabled={!allDone || claimed} loading={claiming} onClick={claim}>
            <Gift className="h-4 w-4" aria-hidden />
            {claimed ? "Reward claimed today" : allDone ? `Claim +${XP.missionsBonus} XP` : "Complete all to unlock a bonus"}
          </Button>
          <div className="mt-5 rounded-2xl border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted">Weekly challenge · {weekly.endsIn} days left</p>
            <p className="mt-1 text-sm font-bold">{weekly.title}</p>
            <ProgressBar value={weekly.progress / weekly.target} className="mt-2 h-2" color="bg-primary" label="Weekly challenge" />
            <p className="mt-1 text-xs text-muted">
              {Math.min(weekly.progress, weekly.target)}/{weekly.target} XP
            </p>
          </div>
        </Card>

        {/* Today's plan */}
        <Card>
          <CardHeader title="Today's plan" icon={<CalendarCheck className="h-5 w-5 text-emerald-500" />} action={<Badge>{plan.reduce((n, p) => n + p.minutes, 0)} min</Badge>} />
          <ol className="space-y-2">
            {plan.map((p, i) => (
              <li key={p.id}>
                <Link href={p.href} className="group flex items-start gap-3 rounded-2xl p-2 transition hover:bg-surface-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold group-hover:text-primary">{p.title}</span>
                    <span className="block text-xs text-muted">
                      {p.minutes} min · {p.reason}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader title="Achievements" icon={<Trophy className="h-5 w-5 text-amber-500" />} action={<Link href="/achievements" className="text-sm font-semibold text-primary hover:underline">View all</Link>} />
          {recent.length > 0 ? (
            <ul className="space-y-2">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                  <span className="text-2xl" aria-hidden>{a.icon}</span>
                  <span>
                    <span className="block text-sm font-bold">{a.title}</span>
                    <span className="block text-xs text-muted">{a.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Complete your first lesson to earn your first badge.</p>
          )}
          {nextAch && (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-3">
              <p className="text-xs font-semibold uppercase text-muted">Next up</p>
              <p className="mt-1 text-sm font-bold">
                {nextAch.a.icon} {nextAch.a.title}
              </p>
              <p className="text-xs text-muted">{nextAch.a.description}</p>
              <ProgressBar value={nextAch.p} className="mt-2 h-2" color="bg-amber-400" label={nextAch.a.title} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
