"use client";
import * as React from "react";
import type { LearnerAction } from "@/lib/actions";
import { contentRepo, type LanguageRow } from "@/lib/data/content";
import { learnerRepo } from "@/lib/data/learner";
import { applyWrites } from "@/lib/engine";
import { ACHIEVEMENTS } from "@/lib/gamification";
import type { Course, LearnerState, VocabWord } from "@/lib/types";
import { useAuth } from "./auth";
import { useToast } from "./toast";

interface LearnerCtx {
  state: LearnerState | null;
  loading: boolean;
  error: string | null;
  course: Course | null;
  courseLoading: boolean;
  vocabulary: VocabWord[];
  languages: LanguageRow[];
  reload: () => Promise<void>;
  reloadContent: () => Promise<void>;
  act: <R = Record<string, unknown>>(action: LearnerAction) => Promise<R>;
}

const Ctx = React.createContext<LearnerCtx | null>(null);

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [state, setState] = React.useState<LearnerState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [course, setCourse] = React.useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = React.useState(true);
  const [vocabulary, setVocabulary] = React.useState<VocabWord[]>([]);
  const [languages, setLanguages] = React.useState<LanguageRow[]>([]);
  const stateRef = React.useRef<LearnerState | null>(null);
  stateRef.current = state;

  const reload = React.useCallback(async () => {
    if (!user) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setState(await learnerRepo.load(user.id));
    } catch (e) {
      setError((e as Error).message || "Could not load your progress.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  const targetLang = state?.profile.targetLang;
  const loadContent = React.useCallback(async () => {
    setCourseLoading(true);
    try {
      const langs = await contentRepo.listLanguages();
      setLanguages(langs);
      if (!targetLang) {
        setCourse(null);
        setVocabulary([]);
        return;
      }
      const c = await contentRepo.getCourseForLang(targetLang);
      setCourse(c);
      setVocabulary(c ? await contentRepo.getVocabulary(c.id) : []);
    } catch (e) {
      console.error(e);
      setError("Could not load course content.");
    } finally {
      setCourseLoading(false);
    }
  }, [targetLang]);

  React.useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const act = React.useCallback(
    async <R,>(action: LearnerAction): Promise<R> => {
      const current = stateRef.current;
      if (!current) throw new Error("Not signed in");
      const res = await learnerRepo.act<R>(current, action);
      setState((prev) => (prev ? applyWrites(prev, res.writes) : prev));
      const unlocked = (res.result as { unlockedAchievements?: string[] })?.unlockedAchievements ?? [];
      for (const id of unlocked) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) toast({ title: `Achievement unlocked: ${a.title}`, description: a.description, icon: a.icon, tone: "success" });
      }
      return res.result;
    },
    [toast],
  );

  return (
    <Ctx.Provider value={{ state, loading, error, course, courseLoading, vocabulary, languages, reload, reloadContent: loadContent, act }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLearner() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useLearner must be used inside LearnerProvider");
  return c;
}

/** Convenience: the loaded state (only call inside the authenticated app shell). */
export function useLearnerState() {
  const { state } = useLearner();
  if (!state) throw new Error("Learner state not loaded");
  return state;
}
