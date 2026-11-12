"use client";
import { LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/components/providers/auth";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useTheme, type ThemePref } from "@/components/providers/theme";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { deleteLocalAccount } from "@/lib/data/local-store";
import { allTimezones } from "@/lib/dates";
import { xpGoalForMinutes } from "@/lib/gamification";
import { getLanguage } from "@/lib/languages";
import type { LearningGoal, Proficiency } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const state = useLearnerState();
  const { act } = useLearner();
  const { user, mode, signOut, updatePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const p = state.profile;
  const [name, setName] = React.useState(p.displayName);
  const [minutes, setMinutes] = React.useState(p.dailyMinutes);
  const [xpGoal, setXpGoal] = React.useState(p.dailyXpGoal);
  const [tz, setTz] = React.useState(p.timezone);
  const [proficiency, setProficiency] = React.useState<Proficiency>(p.proficiency);
  const [goal, setGoal] = React.useState<LearningGoal>(p.goal);
  const [saving, setSaving] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [pwSaving, setPwSaving] = React.useState(false);
  const zones = React.useMemo(() => allTimezones(), []);

  const save = async () => {
    setSaving(true);
    try {
      await act({ type: "updateProfile", patch: { displayName: name, dailyMinutes: minutes, dailyXpGoal: xpGoal, timezone: tz, proficiency, goal } });
      toast({ title: "Settings saved", tone: "success" });
    } catch (e) {
      toast({ title: "Couldn't save settings", description: (e as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const changeTheme = (t: ThemePref) => {
    setTheme(t);
    void act({ type: "updateProfile", patch: { theme: t } }).catch(() => undefined);
  };

  const toggleLeaderboard = async (v: boolean) => {
    try {
      await act({ type: "updateProfile", patch: { showOnLeaderboard: v } });
    } catch (e) {
      toast({ title: "Couldn't update", description: (e as Error).message, tone: "error" });
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast({ title: "Use at least 8 characters", tone: "error" });
    setPwSaving(true);
    try {
      await updatePassword(pw);
      setPw("");
      toast({ title: "Password updated", tone: "success" });
    } catch (err) {
      toast({ title: "Couldn't update password", description: (err as Error).message, tone: "error" });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile & settings" subtitle={user?.email} />

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-2xl font-bold text-white" aria-hidden>
            {name.slice(0, 1).toUpperCase() || "?"}
          </span>
          <div className="text-sm text-muted">
            Learning <strong className="text-fg">{getLanguage(p.targetLang).name}</strong> · speaks {getLanguage(p.nativeLang).name} ·{" "}
            <Link href="/languages" className="font-semibold text-primary hover:underline">
              change
            </Link>
            <br />
            Member since {new Date(p.createdAt).toLocaleDateString()} {p.role === "admin" && "· Administrator"}
          </div>
        </div>
        <Field label="Display name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proficiency" htmlFor="proficiency">
            <Select id="proficiency" value={proficiency} onChange={(e) => setProficiency(e.target.value as Proficiency)}>
              <option value="beginner">Beginner</option>
              <option value="elementary">Elementary</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="Learning goal" htmlFor="goal">
            <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as LearningGoal)}>
              <option value="travel">Travel</option>
              <option value="education">Education</option>
              <option value="career">Career</option>
              <option value="communication">Communication</option>
              <option value="personal">Personal interest</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-bold">Daily goal</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minutes per day" htmlFor="minutes">
            <Select
              id="minutes"
              value={minutes}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMinutes(m);
                setXpGoal(xpGoalForMinutes(m));
              }}
            >
              {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Daily XP goal" htmlFor="xpgoal">
            <Input id="xpgoal" type="number" min={10} max={500} value={xpGoal} onChange={(e) => setXpGoal(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Timezone" htmlFor="tz" hint="Your streak resets at midnight in this timezone.">
          <Select id="tz" value={tz} onChange={(e) => setTz(e.target.value)}>
            {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-bold">Appearance & privacy</h2>
        <div>
          <p className="mb-2 text-sm font-semibold">Theme</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {(
              [
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
                ["system", "System", Monitor],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                onClick={() => changeTheme(id)}
                className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-semibold", theme === id ? "border-primary bg-indigo-500/10 text-primary" : "border-border hover:bg-surface-2")}
              >
                <Icon className="h-5 w-5" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="lb" className="text-sm">
            <span className="block font-semibold">Show me on the leaderboard</span>
            <span className="text-muted">Only your display name and XP are shown.</span>
          </label>
          <Switch id="lb" checked={p.showOnLeaderboard} onChange={toggleLeaderboard} label="Show me on the leaderboard" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-bold">Security</h2>
        <form onSubmit={changePassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="New password" htmlFor="newpw">
              <Input id="newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="outline" loading={pwSaving}>
            Change password
          </Button>
        </form>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          {mode === "local" && user && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm("Delete this local account and all its progress from this browser? This cannot be undone.")) {
                  deleteLocalAccount(user.id);
                  window.location.href = "/";
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete local account
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
