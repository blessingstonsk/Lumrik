"use client";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { RequireAuth } from "@/components/app-shell";
import { LanguageGrid, LanguageMultiGrid, MainLanguageChips } from "@/components/language-picker";
import { Logo } from "@/components/logo";
import { Lumi } from "@/components/lumi";
import { useLearner } from "@/components/providers/learner";
import { Button } from "@/components/ui/button";
import { Badge, ProgressBar } from "@/components/ui/misc";
import { contentRepo } from "@/lib/data/content";
import { browserTimezone } from "@/lib/dates";
import { xpGoalForMinutes } from "@/lib/gamification";
import { getLanguage } from "@/lib/languages";
import type { LearningGoal, Proficiency } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS: { id: Proficiency; title: string; text: string; icon: string }[] = [
  { id: "beginner", title: "I'm new", text: "I don't know any words yet", icon: "🌱" },
  { id: "elementary", title: "I know some words", text: "Basic greetings and phrases", icon: "🌿" },
  { id: "intermediate", title: "I can have simple conversations", text: "Everyday topics with some effort", icon: "🌳" },
  { id: "advanced", title: "I'm fairly fluent", text: "I want to polish and go deeper", icon: "🏔️" },
];
const GOALS: { id: LearningGoal; title: string; icon: string }[] = [
  { id: "travel", title: "Travel", icon: "✈️" },
  { id: "education", title: "Education", icon: "🎓" },
  { id: "career", title: "Career", icon: "💼" },
  { id: "communication", title: "Connect with people", icon: "💬" },
  { id: "personal", title: "Personal interest", icon: "✨" },
];
const MINUTES = [
  { m: 5, label: "Casual" },
  { m: 10, label: "Regular" },
  { m: 15, label: "Serious" },
  { m: 20, label: "Intense" },
];

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition", selected ? "border-primary bg-indigo-500/10" : "border-border bg-surface hover:bg-surface-2")}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const { state, languages, act } = useLearner();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [natives, setNatives] = React.useState<string[]>(state?.profile.onboarded ? state.profile.nativeLangs : []);
  const [target, setTarget] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState<Proficiency | null>(null);
  const [goal, setGoal] = React.useState<LearningGoal | null>(null);
  const [minutes, setMinutes] = React.useState<number | null>(null);
  const [courseLangs, setCourseLangs] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    contentRepo
      .listCourses()
      .then((cs) => setCourseLangs(cs.filter((c) => c.published).map((c) => c.targetLang)))
      .catch(() => setCourseLangs([]));
  }, []);

  const steps = [
    { q: "Which languages do you speak?", ok: natives.length > 0 },
    { q: "Which language would you like to learn?", ok: !!target },
    { q: "How well do you know it?", ok: !!level },
    { q: "Why are you learning it?", ok: !!goal },
    { q: "How much time can you practise each day?", ok: !!minutes },
  ];
  const hasCourse = target ? courseLangs.includes(target) : false;

  const save = async (then: "placement" | "dashboard") => {
    setSaving(true);
    setError(null);
    try {
      await act({
        type: "updateProfile",
        patch: {
          nativeLangs: natives,
          targetLang: target!,
          proficiency: level!,
          goal: goal!,
          dailyMinutes: minutes!,
          dailyXpGoal: xpGoalForMinutes(minutes!),
          timezone: browserTimezone(),
          onboarded: true,
        },
      });
      router.replace(then === "placement" ? "/placement" : "/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const finalStep = step === steps.length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6">
      <div className="flex items-center gap-4">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} aria-label="Previous question" className="rounded-lg p-1 text-muted hover:bg-surface-2">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : (
          <Logo compact href="/" />
        )}
        <ProgressBar value={step / steps.length} label="Onboarding progress" />
      </div>

      <main id="main" className="flex-1 py-8">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
            {!finalStep && (
              <>
                <div className="mb-6 flex items-end gap-3">
                  <Lumi mood={step === 0 ? "wave" : steps[step].ok ? "happy" : "idle"} size={76} className="shrink-0" />
                  <div className="mb-2 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold text-primary">
                      Question {step + 1} of {steps.length}
                    </p>
                    <h1 className="font-display text-xl font-extrabold sm:text-2xl">{steps[step].q}</h1>
                  </div>
                </div>
              </>
            )}

            {step === 0 && (
              <>
                <p className="mb-4 text-sm text-muted">Select every language you speak. The first one you pick is your main language – the tutor explains things in it.</p>
                <LanguageMultiGrid label="Languages you speak" languages={languages} value={natives} onChange={(v) => { setNatives(v); if (target && v.includes(target)) setTarget(null); }} />
                <MainLanguageChips languages={languages} value={natives} onChange={setNatives} />
              </>
            )}
            {step === 1 && (
              <LanguageGrid
                label="Language to learn"
                languages={languages}
                value={target}
                onChange={setTarget}
                disabledCodes={natives}
                badge={(code) => (courseLangs.includes(code) ? <Badge tone="success" className="mt-1">Course available</Badge> : <Badge className="mt-1">AI tutor only</Badge>)}
              />
            )}
            {step === 2 && (
              <div role="radiogroup" aria-label="Proficiency" className="space-y-3">
                {LEVELS.map((l) => (
                  <OptionCard key={l.id} selected={level === l.id} onClick={() => setLevel(l.id)}>
                    <span className="text-3xl">{l.icon}</span>
                    <span>
                      <span className="block font-bold">{l.title}</span>
                      <span className="block text-sm text-muted">{l.text}</span>
                    </span>
                  </OptionCard>
                ))}
              </div>
            )}
            {step === 3 && (
              <div role="radiogroup" aria-label="Learning goal" className="grid gap-3 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <OptionCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)}>
                    <span className="text-3xl">{g.icon}</span>
                    <span className="font-bold">{g.title}</span>
                  </OptionCard>
                ))}
              </div>
            )}
            {step === 4 && (
              <div role="radiogroup" aria-label="Daily minutes" className="space-y-3">
                {MINUTES.map((m) => (
                  <OptionCard key={m.m} selected={minutes === m.m} onClick={() => setMinutes(m.m)}>
                    <span className="flex-1 font-bold">{m.m} minutes / day</span>
                    <span className="text-sm text-muted">
                      {m.label} · {xpGoalForMinutes(m.m)} XP goal
                    </span>
                  </OptionCard>
                ))}
              </div>
            )}
            {finalStep && target && (
              <div className="text-center">
                <div className="flex justify-center">
                  <Lumi mood="celebrate" size={130} />
                </div>
                <h1 className="mt-4 font-display text-3xl font-extrabold">You&apos;re all set!</h1>
                <p className="mx-auto mt-2 max-w-md text-muted">
                  {hasCourse
                    ? level === "beginner"
                      ? "Start with lesson one, or take a 2-minute placement test if you already know a little."
                      : "Take a quick 2-minute placement test so we can skip what you already know."
                    : `The ${getLanguage(target).name} course is still being written by our team. You can practise with the AI tutor and speaking drills in the meantime.`}
                </p>
                {error && (
                  <p role="alert" className="mt-4 text-sm text-rose-500">
                    {error}
                  </p>
                )}
                <div className="mx-auto mt-8 grid max-w-sm gap-3">
                  {hasCourse && (
                    <Button size="lg" variant={level === "beginner" ? "outline" : "primary"} loading={saving} onClick={() => save("placement")}>
                      Take the placement test
                    </Button>
                  )}
                  <Button size="lg" variant={hasCourse && level !== "beginner" ? "outline" : "primary"} loading={saving} onClick={() => save("dashboard")}>
                    {hasCourse ? "Start from the beginning" : "Go to my dashboard"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
      </main>

      {!finalStep && (
        <div className="sticky bottom-0 bg-bg py-4">
          <Button size="lg" block disabled={!steps[step].ok} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth allowUnonboarded>
      <Onboarding />
    </RequireAuth>
  );
}
