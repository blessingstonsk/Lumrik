"use client";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useLearnerState } from "@/components/providers/learner";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/misc";
import { ACHIEVEMENTS, computeStats } from "@/lib/gamification";
import { cn } from "@/lib/utils";

const TIER = { bronze: "from-amber-600 to-amber-400", silver: "from-slate-400 to-slate-200", gold: "from-yellow-500 to-amber-300" };

const MILESTONES = [
  { xp: 100, label: "First 100 XP" },
  { xp: 500, label: "500 XP" },
  { xp: 1000, label: "1,000 XP" },
  { xp: 2500, label: "2,500 XP" },
  { xp: 5000, label: "5,000 XP" },
];

export default function AchievementsPage() {
  const state = useLearnerState();
  const stats = computeStats(state);
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;

  return (
    <div>
      <PageHeader title="Achievements" subtitle={`${unlocked} of ${ACHIEVEMENTS.length} badges earned`} />

      <Card className="mb-8">
        <h2 className="mb-4 font-display text-lg font-bold">Learning milestones</h2>
        <ol className="flex items-center gap-2 overflow-x-auto pb-2">
          {MILESTONES.map((m, i) => {
            const reached = state.xpTotal >= m.xp;
            return (
              <li key={m.xp} className="flex items-center gap-2">
                <div className={cn("flex min-w-28 flex-col items-center rounded-2xl border-2 px-3 py-3 text-center", reached ? "border-secondary bg-emerald-500/10" : "border-dashed border-border")}>
                  <span className="text-2xl" aria-hidden>
                    {reached ? "🏅" : "🔒"}
                  </span>
                  <span className="mt-1 text-xs font-bold">{m.label}</span>
                  <span className="sr-only">{reached ? "reached" : "not reached yet"}</span>
                </div>
                {i < MILESTONES.length - 1 && <span className={cn("h-1 w-6 rounded", reached ? "bg-secondary" : "bg-border")} aria-hidden />}
              </li>
            );
          })}
        </ol>
      </Card>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a, i) => {
          const at = state.achievements[a.id];
          const progress = Math.min(1, stats[a.metric] / a.target);
          return (
            <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className={cn("flex h-full items-start gap-4", !at && "opacity-80")}>
                <div className={cn("relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-inner", at ? TIER[a.tier] : "from-slate-200 to-slate-100 grayscale dark:from-slate-700 dark:to-slate-600")}>
                  <span aria-hidden>{a.icon}</span>
                  {!at && <Lock className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface p-0.5 text-muted" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold">{a.title}</h2>
                    <Badge tone={a.tier === "gold" ? "warning" : a.tier === "silver" ? "neutral" : "primary"} className="capitalize">
                      {a.tier}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">{a.description}</p>
                  {at ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Earned {new Date(at).toLocaleDateString()}</p>
                  ) : (
                    <>
                      <ProgressBar value={progress} className="mt-2 h-2" color="bg-amber-400" label={`${a.title} progress`} />
                      <p className="mt-1 text-xs text-muted">
                        {Math.min(stats[a.metric], a.target)} / {a.target}
                      </p>
                    </>
                  )}
                </div>
              </Card>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
