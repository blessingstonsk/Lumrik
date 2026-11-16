"use client";
import * as React from "react";
import { LanguageGrid, LanguageMultiGrid, MainLanguageChips } from "@/components/language-picker";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { contentRepo } from "@/lib/data/content";
import { getLanguage } from "@/lib/languages";

export default function LanguagesPage() {
  const state = useLearnerState();
  const { languages, act } = useLearner();
  const toast = useToast();
  const [natives, setNatives] = React.useState<string[]>(state.profile.nativeLangs);
  const [target, setTarget] = React.useState(state.profile.targetLang);
  const [courseLangs, setCourseLangs] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    contentRepo.listCourses().then((cs) => setCourseLangs(cs.filter((c) => c.published).map((c) => c.targetLang))).catch(() => undefined);
  }, []);

  const dirty = natives.join() !== state.profile.nativeLangs.join() || target !== state.profile.targetLang;
  const save = async () => {
    if (natives.length === 0) {
      toast({ title: "Select at least one language you speak", tone: "error" });
      return;
    }
    if (natives.includes(target)) {
      toast({ title: "You already speak that language", description: "Pick a different language to learn.", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await act({ type: "updateProfile", patch: { nativeLangs: natives, targetLang: target } });
      toast({ title: `Now learning ${getLanguage(target).name}`, description: "Your progress in other courses is kept.", icon: getLanguage(target).flag, tone: "success" });
    } catch (e) {
      toast({ title: "Couldn't save", description: (e as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Languages"
        subtitle="Choose the language you speak and the one you're learning."
        action={
          <Button onClick={save} disabled={!dirty} loading={saving}>
            Save changes
          </Button>
        }
      />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-display text-lg font-bold">I want to learn</h2>
          <p className="mb-4 text-sm text-muted">Languages without a published course can still be practised with the AI tutor and speaking drills.</p>
          <LanguageGrid
            label="Language to learn"
            languages={languages}
            value={target}
            onChange={setTarget}
            disabledCodes={natives}
            badge={(code) => (courseLangs.includes(code) ? <Badge tone="success" className="mt-1">Course</Badge> : <Badge className="mt-1">Tutor only</Badge>)}
          />
        </Card>
        <Card>
          <h2 className="mb-1 font-display text-lg font-bold">I speak</h2>
          <p className="mb-4 text-sm text-muted">Select every language you speak. The AI tutor explains grammar in your main language.</p>
          <LanguageMultiGrid label="Languages you speak" languages={languages} value={natives} onChange={setNatives} disabledCodes={[target]} />
          <MainLanguageChips languages={languages} value={natives} onChange={setNatives} />
        </Card>
      </div>
    </div>
  );
}
