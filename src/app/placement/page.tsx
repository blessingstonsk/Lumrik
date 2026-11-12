"use client";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { NoCourseNotice, RequireAuth } from "@/components/app-shell";
import { Confetti } from "@/components/lesson/celebration";
import { ExerciseView } from "@/components/lesson/exercises";
import { useLearner } from "@/components/providers/learner";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, ProgressBar, Spinner } from "@/components/ui/misc";
import { contentRepo } from "@/lib/data/content";
import { getLanguage } from "@/lib/languages";
import type { AnswerSubmission, Exercise, PlacementQuestion } from "@/lib/types";

function Placement() {
  const { course, courseLoading, state, act } = useLearner();
  const router = useRouter();
  const [questions, setQuestions] = React.useState<PlacementQuestion[] | null>(null);
  const [i, setI] = React.useState(0);
  const [value, setValue] = React.useState<string | null>(null);
  const answers = React.useRef<AnswerSubmission[]>([]);
  const [result, setResult] = React.useState<{ startUnit: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (course) contentRepo.getPlacement(course.id).then(setQuestions);
  }, [course]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      setResult(await act<{ startUnit: number }>({ type: "placement", courseId: course!.id, answers: answers.current }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!questions || value === null) return;
    answers.current = [...answers.current.filter((a) => a.exerciseId !== questions[i].id), { exerciseId: questions[i].id, answer: value }];
    setValue(null);
    if (i + 1 >= questions.length) void submit();
    else setI(i + 1);
  };

  if (courseLoading) return <Spinner className="min-h-dvh" />;
  if (!course)
    return (
      <div className="mx-auto max-w-xl p-8">
        <NoCourseNotice />
      </div>
    );
  if (!questions) return <Spinner className="min-h-dvh" />;

  if (result) {
    const unit = course.units.find((u) => u.order === result.startUnit);
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 text-center">
        {result.startUnit > 1 && <Confetti />}
        <div className="text-6xl">{result.startUnit > 1 ? "🚀" : "🌱"}</div>
        <h1 className="mt-4 font-display text-3xl font-extrabold">{result.startUnit > 1 ? "Nice – you can skip ahead!" : "Let's start from the beginning"}</h1>
        <p className="mt-2 text-muted">
          {unit
            ? `We've unlocked everything before Unit ${unit.order}: “${unit.title}”. Earlier lessons stay open for review any time.`
            : "You already know the whole beginner course! All lessons are unlocked – try the AI tutor for more challenge."}
        </p>
        <ButtonLink href="/learn" size="lg" className="mt-8">
          See my learning path
        </ButtonLink>
      </div>
    );
  }

  const q = questions[i];
  const ex: Exercise = { id: q.id, lessonId: "placement", order: i, instruction: q.instruction, data: q.data, explanation: "", wordIds: [] };
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} aria-label="Exit placement test" className="rounded-lg p-1 text-muted hover:bg-surface-2">
          <X className="h-6 w-6" />
        </button>
        <ProgressBar value={i / questions.length} label="Placement progress" />
      </div>
      <main id="main" className="flex-1 py-8">
        <p className="text-sm font-semibold text-primary">
          Placement test · {i + 1} of {questions.length}
        </p>
        <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="mb-6 mt-1 text-lg font-bold text-muted">{q.instruction}</h1>
          <ExerciseView exercise={ex} value={value} onChange={setValue} locked={saving} locale={getLanguage(state?.profile.targetLang).speechLocale} />
        </motion.div>
        {error && (
          <div className="mt-6">
            <ErrorState message={error} onRetry={submit} />
          </div>
        )}
      </main>
      <div className="sticky bottom-0 flex gap-3 bg-bg py-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setValue("");
            answers.current.push({ exerciseId: q.id, answer: "" });
            setValue(null);
            if (i + 1 >= questions.length) void submit();
            else setI(i + 1);
          }}
        >
          I don&apos;t know
        </Button>
        <Button size="lg" block disabled={value === null} loading={saving} onClick={next}>
          {i + 1 === questions.length ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}

export default function PlacementPage() {
  return (
    <RequireAuth>
      <Placement />
    </RequireAuth>
  );
}
