"use client";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";
import { RequireAuth } from "@/components/app-shell";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { useLearner } from "@/components/providers/learner";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/misc";
import { buildReviewLesson, lessonNodes, pickReviewWords } from "@/lib/adaptive";
import { contentRepo } from "@/lib/data/content";
import type { Lesson } from "@/lib/types";

function LessonLoader() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { state, course, courseLoading, vocabulary } = useLearner();
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const isReview = lessonId === "review";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isReview) {
        if (!state || courseLoading) return;
        const ids = pickReviewWords(state);
        setLesson(ids.length ? buildReviewLesson(ids, vocabulary) : null);
      } else {
        setLesson(await contentRepo.getLesson(lessonId));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // Build the review lesson once (not on every state change while playing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, isReview, courseLoading]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading || (isReview && courseLoading)) return <Spinner className="min-h-dvh" label="Loading lesson" />;
  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  if (!lesson || lesson.exercises.length === 0)
    return (
      <div className="mx-auto max-w-md p-8">
        <EmptyState
          icon="🎉"
          title={isReview ? "Nothing to review right now" : "Lesson not found"}
          description={isReview ? "You have no weak or due words. Complete more lessons and come back later." : "This lesson doesn't exist or isn't published."}
          action={<ButtonLink href="/learn">Go to learning path</ButtonLink>}
        />
      </div>
    );

  if (!isReview) {
    const nodes = course ? lessonNodes(course, state) : [];
    const node = nodes.find((n) => n.id === lesson.id);
    if (node?.state === "locked" || !lesson.published)
      return (
        <div className="mx-auto max-w-md p-8">
          <EmptyState
            icon={<Lock className="h-10 w-10 text-muted" />}
            title="This lesson is locked"
            description="Complete the previous lesson first, or take the placement test to skip ahead."
            action={<ButtonLink href="/learn">Back to learning path</ButtonLink>}
          />
        </div>
      );
    const idx = nodes.findIndex((n) => n.id === lesson.id);
    const nextLessonId = idx >= 0 ? nodes[idx + 1]?.id ?? null : null;
    return <LessonPlayer key={lesson.id} lesson={lesson} nextLessonId={nextLessonId} />;
  }
  return <LessonPlayer key={lesson.id} lesson={lesson} mode="review" />;
}

export default function LessonPage() {
  return (
    <RequireAuth>
      <LessonLoader />
    </RequireAuth>
  );
}
