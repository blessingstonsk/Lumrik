"use client";
import { Crown, Medal, Zap } from "lucide-react";
import * as React from "react";
import { useLearnerState } from "@/components/providers/learner";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Tabs } from "@/components/ui/misc";
import { isSupabaseEnabled } from "@/lib/config";
import { allLocalStates } from "@/lib/data/local-store";
import { addDays, dayKey, weekStart } from "@/lib/dates";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatNumber } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  xp: number;
  me: boolean;
}

type Period = "week" | "month";

export default function LeaderboardPage() {
  const state = useLearnerState();
  const [period, setPeriod] = React.useState<Period>("week");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const today = dayKey(new Date(), state.profile.timezone);
  const since = period === "week" ? weekStart(today) : addDays(today, -29);

  const load = React.useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      if (isSupabaseEnabled) {
        const { data, error: err } = await supabaseBrowser().rpc("get_leaderboard", { p_since: since, p_limit: 50 });
        if (err) throw new Error(err.message);
        setRows((data ?? []).map((r: { user_id: string; display_name: string; xp: number; is_me: boolean }) => ({ id: r.user_id, name: r.display_name, xp: Number(r.xp), me: r.is_me })));
      } else {
        // Local mode: real learners on this device only.
        const list = allLocalStates()
          .filter((s) => s.profile.showOnLeaderboard || s.profile.id === state.profile.id)
          .map((s) => ({
            id: s.profile.id,
            name: s.profile.displayName,
            xp: Object.values(s.activity).filter((a) => a.day >= since).reduce((n, a) => n + a.xp, 0),
            me: s.profile.id === state.profile.id,
          }))
          .filter((r) => r.xp > 0 || r.me)
          .sort((a, b) => b.xp - a.xp);
        setRows(list);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [since, state.profile.id]);

  React.useEffect(() => {
    void load();
  }, [load, state.xpTotal]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Leaderboard"
        subtitle={isSupabaseEnabled ? "XP earned by learners who share their progress." : "Local mode: ranking learners on this device."}
        action={<Tabs label="Period" value={period} onChange={setPeriod} tabs={[{ id: "week", label: "This week" }, { id: "month", label: "30 days" }]} />}
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !rows ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon="🏁" title="No XP earned yet this period" description="Complete a lesson to get on the board!" action={<ButtonLink href="/learn">Start learning</ButtonLink>} />
      ) : (
        <Card className="p-2">
          <ol>
            {rows.map((r, i) => (
              <li key={r.id} className={cn("flex items-center gap-4 rounded-2xl px-4 py-3", r.me && "bg-indigo-500/10")} aria-current={r.me ? "true" : undefined}>
                <span className="flex w-8 justify-center font-display text-lg font-extrabold text-muted">
                  {i === 0 ? <Crown className="h-6 w-6 text-yellow-500" aria-label="1st" /> : i === 1 ? <Medal className="h-6 w-6 text-slate-400" aria-label="2nd" /> : i === 2 ? <Medal className="h-6 w-6 text-amber-600" aria-label="3rd" /> : i + 1}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 font-bold text-white" aria-hidden>
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {r.name} {r.me && <span className="text-sm text-primary">(you)</span>}
                </span>
                <span className="flex items-center gap-1 font-bold text-amber-500">
                  <Zap className="h-4 w-4" fill="currentColor" aria-hidden /> {formatNumber(r.xp)}
                  <span className="sr-only">XP</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <p className="mt-4 text-center text-xs text-muted">You can hide yourself from the leaderboard in Settings.</p>
    </div>
  );
}
