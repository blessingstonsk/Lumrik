"use client";
import { ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Plus, ShieldAlert, Trash2, Upload, X } from "lucide-react";
import * as React from "react";
import { SimpleBarChart } from "@/components/charts";
import { useLearner, useLearnerState } from "@/components/providers/learner";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, PageSkeleton, Spinner, Tabs } from "@/components/ui/misc";
import { isSupabaseEnabled } from "@/lib/config";
import { contentRepo, resetLocalContent, type LanguageRow } from "@/lib/data/content";
import { allLocalStates } from "@/lib/data/local-store";
import { addDays, dayKey } from "@/lib/dates";
import { ExerciseListSchema, LanguageSchema } from "@/lib/schemas";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CefrLevel, Course, Lesson, VocabWord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "content" | "vocab" | "languages" | "learners";

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("w-full rounded-3xl bg-surface p-6 shadow-xl", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Content management ─────────────────────────────────────
function LessonEditor({ lesson, onClose, onSaved }: { lesson: Lesson; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = React.useState(lesson.title);
  const [description, setDescription] = React.useState(lesson.description);
  const [tip, setTip] = React.useState(lesson.tip ?? "");
  const [json, setJson] = React.useState(JSON.stringify(lesson.exercises.map(({ id, instruction, explanation, wordIds, data }) => ({ id, instruction, explanation, wordIds, data })), null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setError(null);
    let parsed;
    try {
      parsed = ExerciseListSchema.parse(JSON.parse(json));
    } catch (e) {
      const msg = e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : (e as { issues?: { path: (string | number)[]; message: string }[] }).issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") ?? String(e);
      setError(msg);
      return;
    }
    if (new Set(parsed.map((p) => p.id)).size !== parsed.length) return setError("Exercise ids must be unique");
    setSaving(true);
    try {
      await contentRepo.saveLesson({
        ...lesson,
        title,
        description,
        tip: tip || undefined,
        exerciseCount: parsed.length,
        xpReward: 5 + parsed.length * 2,
        exercises: parsed.map((p, i) => ({ ...p, lessonId: lesson.id, order: i + 1, data: p.data as Lesson["exercises"][number]["data"] })),
      });
      toast({ title: "Lesson saved", tone: "success" });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit lesson · ${lesson.id}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="l-title">
            <Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="l-desc">
            <Input id="l-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <Field label="Teaching tip (shown before the lesson)" htmlFor="l-tip">
          <Textarea id="l-tip" value={tip} onChange={(e) => setTip(e.target.value)} rows={2} />
        </Field>
        <Field
          label="Exercises (JSON)"
          htmlFor="l-json"
          hint="Types: multiple_choice, match_pairs, fill_blank, listening, speaking, sentence_builder, translate. Every exercise is validated before saving."
        >
          <Textarea id="l-json" value={json} onChange={(e) => setJson(e.target.value)} rows={18} className="font-mono text-xs" spellCheck={false} />
        </Field>
        {error && <pre className="whitespace-pre-wrap rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300" role="alert">{error}</pre>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save lesson
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ContentTab({ languages }: { languages: LanguageRow[] }) {
  const toast = useToast();
  const { reloadContent } = useLearner();
  const [courses, setCourses] = React.useState<Course[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [editing, setEditing] = React.useState<Lesson | null>(null);
  const [newCourse, setNewCourse] = React.useState(false);
  const [newUnitFor, setNewUnitFor] = React.useState<Course | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setCourses(await contentRepo.listCourses(true));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    await load();
    await reloadContent();
  };

  const publish = async (kind: "course" | "unit" | "lesson", id: string, value: boolean) => {
    try {
      await contentRepo.setPublished(kind, id, value);
      toast({ title: value ? "Published" : "Unpublished", tone: "success" });
      await refresh();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, tone: "error" });
    }
  };

  const openLesson = async (id: string) => {
    const l = await contentRepo.getLesson(id);
    if (l) setEditing(l);
  };

  const addLesson = async (course: Course, unitId: string) => {
    const unit = course.units.find((u) => u.id === unitId)!;
    const order = (unit.lessons.at(-1)?.order ?? 0) + 1;
    const id = `${unitId}-l${order}-${Date.now().toString(36).slice(-4)}`;
    const lesson: Lesson = {
      id,
      unitId,
      order,
      title: "New lesson",
      description: "Describe the lesson",
      published: false,
      xpReward: 7,
      exerciseCount: 1,
      exercises: [{ id: `${id}-e1`, lessonId: id, order: 1, instruction: "Choose the correct answer", explanation: "Explain the answer.", wordIds: [], data: { type: "multiple_choice", question: "Question?", choices: ["Answer", "Wrong"], answer: 0 } }],
    };
    try {
      await contentRepo.saveLesson(lesson);
      await refresh();
      setEditing(lesson);
    } catch (e) {
      toast({ title: "Couldn't create lesson", description: (e as Error).message, tone: "error" });
    }
  };

  const removeLesson = async (id: string) => {
    if (!confirm("Delete this lesson and its exercises? Learner progress for it will also be removed.")) return;
    try {
      await contentRepo.deleteLesson(id);
      await refresh();
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, tone: "error" });
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!courses) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNewCourse(true)}>
          <Plus className="h-4 w-4" /> New course
        </Button>
      </div>
      {courses.map((c) => (
        <Card key={c.id} className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-2xl">{languages.find((l) => l.code === c.targetLang)?.flag ?? "🌐"}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{c.title}</p>
              <p className="text-xs text-muted">
                {c.id} · {c.units.length} units · {c.units.reduce((n, u) => n + u.lessons.length, 0)} lessons
              </p>
            </div>
            <Badge tone={c.published ? "success" : "neutral"}>{c.published ? "Published" : "Draft"}</Badge>
            <Button size="sm" variant="outline" onClick={() => publish("course", c.id, !c.published)}>
              {c.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {c.published ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewUnitFor(c)}>
              <Plus className="h-4 w-4" /> Unit
            </Button>
          </div>
          <ul className="border-t border-border">
            {c.units.map((u) => (
              <li key={u.id} className="border-b border-border last:border-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpen((o) => ({ ...o, [u.id]: !o[u.id] }))} aria-expanded={!!open[u.id]} className="flex flex-1 items-center gap-2 text-left">
                    {open[u.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span aria-hidden>{u.icon}</span>
                    <span className="font-semibold">
                      Unit {u.order}: {u.title}
                    </span>
                    <Badge>{u.cefr}</Badge>
                  </button>
                  <Switch checked={u.published} onChange={(v) => publish("unit", u.id, v)} label={`Publish unit ${u.title}`} />
                </div>
                {open[u.id] && (
                  <ul className="space-y-1 bg-surface-2/50 px-4 py-3">
                    {u.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
                        <span className="w-6 text-xs font-bold text-muted">{l.order}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.title}</span>
                        <span className="hidden text-xs text-muted sm:inline">{l.exerciseCount} ex.</span>
                        <Switch checked={l.published} onChange={(v) => publish("lesson", l.id, v)} label={`Publish lesson ${l.title}`} />
                        <button onClick={() => openLesson(l.id)} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label={`Edit ${l.title}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeLesson(l.id)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10" aria-label={`Delete ${l.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                    <li>
                      <Button size="sm" variant="ghost" onClick={() => addLesson(c, u.id)}>
                        <Plus className="h-4 w-4" /> Add lesson
                      </Button>
                    </li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {editing && <LessonEditor lesson={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {newCourse && <NewCourseModal languages={languages} onClose={() => setNewCourse(false)} onSaved={refresh} />}
      {newUnitFor && <NewUnitModal course={newUnitFor} onClose={() => setNewUnitFor(null)} onSaved={refresh} />}
    </div>
  );
}

function NewCourseModal({ languages, onClose, onSaved }: { languages: LanguageRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [lang, setLang] = React.useState(languages.find((l) => l.code !== "en")?.code ?? "en");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await contentRepo.saveCourse({ id: `${lang}-${Date.now().toString(36)}`, targetLang: lang, title, description, published: false });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't create course", description: (e as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="New course" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Target language" htmlFor="c-lang">
          <Select id="c-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.nativeName})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="c-title">
          <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tamil for Beginners" />
        </Field>
        <Field label="Description" htmlFor="c-desc">
          <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <p className="text-xs text-muted">Courses start as drafts. Add units and lessons, have a fluent speaker review them, then publish.</p>
        <Button onClick={save} loading={saving} disabled={!title.trim()}>
          Create course
        </Button>
      </div>
    </Modal>
  );
}

function NewUnitModal({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cefr, setCefr] = React.useState<CefrLevel>("A1");
  const [icon, setIcon] = React.useState("📘");
  const save = async () => {
    const order = (course.units.at(-1)?.order ?? 0) + 1;
    try {
      await contentRepo.saveUnit({ id: `${course.id}-u${order}`, courseId: course.id, order, title, description, cefr, icon, published: false });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't create unit", description: (e as Error).message, tone: "error" });
    }
  };
  return (
    <Modal title={`New unit in ${course.title}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Title" htmlFor="u-title">
          <Input id="u-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="u-desc">
          <Input id="u-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CEFR level" htmlFor="u-cefr">
            <Select id="u-cefr" value={cefr} onChange={(e) => setCefr(e.target.value as CefrLevel)}>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Icon (emoji)" htmlFor="u-icon">
            <Input id="u-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </Field>
        </div>
        <Button onClick={save} disabled={!title.trim()}>
          Create unit
        </Button>
      </div>
    </Modal>
  );
}

// ── Vocabulary ─────────────────────────────────────────────
function WordEditor({ word, onClose, onSaved }: { word: VocabWord; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [w, setW] = React.useState(word);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const set = (k: keyof VocabWord, v: unknown) => setW((x) => ({ ...x, [k]: v }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) return toast({ title: "Please choose an audio file", tone: "error" });
    setUploading(true);
    try {
      const url = await contentRepo.uploadAudio(file, w.id);
      set("audioUrl", url);
      toast({ title: "Audio uploaded", tone: "success" });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!w.term.trim() || !w.meaning.trim()) return toast({ title: "Term and meaning are required", tone: "error" });
    setSaving(true);
    try {
      await contentRepo.saveWord(w);
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={word.term ? `Edit “${word.term}”` : "New word"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Term" htmlFor="w-term">
          <Input id="w-term" value={w.term} onChange={(e) => set("term", e.target.value)} />
        </Field>
        <Field label="Pronunciation (IPA)" htmlFor="w-ipa">
          <Input id="w-ipa" value={w.pronunciation} onChange={(e) => set("pronunciation", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Meaning / translation" htmlFor="w-meaning">
            <Input id="w-meaning" value={w.meaning} onChange={(e) => set("meaning", e.target.value)} />
          </Field>
        </div>
        <Field label="Part of speech" htmlFor="w-pos">
          <Input id="w-pos" value={w.partOfSpeech} onChange={(e) => set("partOfSpeech", e.target.value)} />
        </Field>
        <Field label="Emoji" htmlFor="w-emoji">
          <Input id="w-emoji" value={w.emoji ?? ""} onChange={(e) => set("emoji", e.target.value || undefined)} maxLength={8} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Example sentence" htmlFor="w-ex">
            <Input id="w-ex" value={w.example} onChange={(e) => set("example", e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Related words (comma separated)" htmlFor="w-rel">
            <Input id="w-rel" value={w.related.join(", ")} onChange={(e) => set("related", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold">Pronunciation audio</p>
          <div className="flex flex-wrap items-center gap-3">
            {w.audioUrl ? <audio controls src={w.audioUrl} className="h-9" /> : <span className="text-sm text-muted">Using browser text-to-speech</span>}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload audio"}
              <input type="file" accept="audio/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
            </label>
            {w.audioUrl && (
              <Button size="sm" variant="ghost" onClick={() => set("audioUrl", null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving}>
          Save word
        </Button>
      </div>
    </Modal>
  );
}

function VocabTab() {
  const toast = useToast();
  const { reloadContent } = useLearner();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [courseId, setCourseId] = React.useState<string>("");
  const [words, setWords] = React.useState<VocabWord[] | null>(null);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<VocabWord | null>(null);

  React.useEffect(() => {
    contentRepo.listCourses(true).then((cs) => {
      setCourses(cs);
      setCourseId((id) => id || cs[0]?.id || "");
    });
  }, []);
  const load = React.useCallback(async () => {
    if (courseId) setWords(await contentRepo.getVocabulary(courseId));
  }, [courseId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const remove = async (w: VocabWord) => {
    if (!confirm(`Delete “${w.term}”? Learners' flashcards for this word will be removed.`)) return;
    try {
      await contentRepo.deleteWord(w.id);
      await load();
      await reloadContent();
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, tone: "error" });
    }
  };

  const list = (words ?? []).filter((w) => !q || w.term.toLowerCase().includes(q.toLowerCase()) || w.meaning.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-auto">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        <Input aria-label="Search vocabulary" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-auto flex-1" />
        <Button
          disabled={!courseId}
          onClick={() =>
            setEditing({ id: `${courseId}-w-${Date.now().toString(36)}`, courseId, lessonId: null, term: "", meaning: "", pronunciation: "", partOfSpeech: "noun", example: "", related: [], audioUrl: null })
          }
        >
          <Plus className="h-4 w-4" /> Add word
        </Button>
      </div>
      {!words ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="No words" description="Add vocabulary for this course." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Term</th>
                <th className="px-4 py-2">Meaning</th>
                <th className="hidden px-4 py-2 md:table-cell">POS</th>
                <th className="hidden px-4 py-2 md:table-cell">Audio</th>
                <th className="px-4 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-4 py-2 font-semibold">
                    {w.emoji} {w.term}
                    <span className="block font-mono text-xs font-normal text-muted">{w.pronunciation}</span>
                  </td>
                  <td className="px-4 py-2">{w.meaning}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{w.partOfSpeech}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{w.audioUrl ? <Badge tone="success">File</Badge> : <Badge>TTS</Badge>}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button onClick={() => setEditing(w)} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label={`Edit ${w.term}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(w)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10" aria-label={`Delete ${w.term}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <WordEditor
          word={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load();
            await reloadContent();
          }}
        />
      )}
    </div>
  );
}

// ── Languages ──────────────────────────────────────────────
function LanguagesTab() {
  const toast = useToast();
  const { reloadContent } = useLearner();
  const [langs, setLangs] = React.useState<LanguageRow[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ code: "", name: "", nativeName: "", flag: "🌐", glyph: "", script: "Latin", speechLocale: "", enabled: true });

  const load = React.useCallback(async () => setLangs(await contentRepo.listLanguages(true)), []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (l: LanguageRow, enabled: boolean) => {
    try {
      await contentRepo.saveLanguage({ ...l, enabled });
      await load();
      await reloadContent();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, tone: "error" });
    }
  };

  const add = async () => {
    const parsed = LanguageSchema.safeParse(form);
    if (!parsed.success) return toast({ title: "Check the form", description: parsed.error.issues[0].message, tone: "error" });
    try {
      await contentRepo.saveLanguage(parsed.data as LanguageRow);
      setAdding(false);
      await load();
      await reloadContent();
      toast({ title: `${form.name} added`, tone: "success" });
    } catch (e) {
      toast({ title: "Couldn't add language", description: (e as Error).message, tone: "error" });
    }
  };

  if (!langs) return <Spinner />;
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add language
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {langs.map((l) => (
          <li key={l.code}>
            <Card className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 font-bold text-primary">{l.glyph}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {l.nativeName} <span className="text-sm font-normal text-muted">({l.name})</span>
                </p>
                <p className="text-xs text-muted">
                  {l.code} · {l.script} · {l.speechLocale}
                </p>
              </div>
              <Switch checked={l.enabled} onChange={(v) => toggle(l, v)} label={`Enable ${l.name}`} />
            </Card>
          </li>
        ))}
      </ul>
      {adding && (
        <Modal title="Add language" onClose={() => setAdding(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["code", "ISO code", "pt"],
                ["name", "English name", "Portuguese"],
                ["nativeName", "Native name", "Português"],
                ["glyph", "Icon glyph (1–3 chars)", "Pt"],
                ["flag", "Flag emoji", "🇵🇹"],
                ["script", "Script", "Latin"],
                ["speechLocale", "Speech locale", "pt-PT"],
              ] as const
            ).map(([k, label, ph]) => (
              <Field key={k} label={label} htmlFor={`lang-${k}`}>
                <Input id={`lang-${k}`} value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
          <Button className="mt-5" onClick={add}>
            Add language
          </Button>
        </Modal>
      )}
    </div>
  );
}

// ── Learners & analytics ───────────────────────────────────
interface AdminStats {
  learners: number;
  active_7d: number;
  lessons_completed: number;
  xp_7d: number;
  attempts_7d: number;
  accuracy_7d: number | null;
  daily: { day: string; learners: number; xp: number }[];
  hardest: { exercise_id: string; attempts: number; accuracy: number }[];
}
interface LearnerRow {
  id: string;
  name: string;
  email: string;
  xp: number;
  role: string;
  targetLang: string;
  createdAt: string;
}

function LearnersTab() {
  const toast = useToast();
  const me = useLearnerState();
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [rows, setRows] = React.useState<LearnerRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      if (isSupabaseEnabled) {
        const sb = supabaseBrowser();
        const [s, p] = await Promise.all([
          sb.rpc("admin_stats"),
          sb.from("profiles").select("id, display_name, email, xp_total, role, target_lang, created_at").order("xp_total", { ascending: false }).limit(200),
        ]);
        if (s.error) throw new Error(s.error.message);
        if (p.error) throw new Error(p.error.message);
        setStats(s.data as AdminStats);
        setRows((p.data ?? []).map((r) => ({ id: r.id, name: r.display_name, email: r.email ?? "", xp: r.xp_total, role: r.role, targetLang: r.target_lang, createdAt: r.created_at })));
      } else {
        const states = allLocalStates();
        const today = dayKey(new Date(), me.profile.timezone);
        const since = addDays(today, -7);
        const attempts = states.flatMap((s) => s.recentAttempts.filter((a) => a.createdAt >= new Date(Date.now() - 7 * 86400000).toISOString()));
        const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
        const byEx = new Map<string, { n: number; ok: number }>();
        for (const a of states.flatMap((s) => s.recentAttempts)) {
          if (a.lessonId.startsWith("review")) continue;
          const e = byEx.get(a.exerciseId) ?? { n: 0, ok: 0 };
          e.n++;
          if (a.correct) e.ok++;
          byEx.set(a.exerciseId, e);
        }
        setStats({
          learners: states.length,
          active_7d: states.filter((s) => Object.keys(s.activity).some((d) => d >= since)).length,
          lessons_completed: states.reduce((n, s) => n + Object.keys(s.lessonProgress).length, 0),
          xp_7d: states.reduce((n, s) => n + Object.values(s.activity).filter((a) => a.day >= since).reduce((m, a) => m + a.xp, 0), 0),
          attempts_7d: attempts.length,
          accuracy_7d: attempts.length ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null,
          daily: days.map((d) => ({ day: d, learners: states.filter((s) => s.activity[d]?.xp).length, xp: states.reduce((n, s) => n + (s.activity[d]?.xp ?? 0), 0) })),
          hardest: [...byEx.entries()]
            .filter(([, v]) => v.n >= 3)
            .map(([id, v]) => ({ exercise_id: id, attempts: v.n, accuracy: Math.round((v.ok / v.n) * 100) }))
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 10),
        });
        setRows(states.map((s) => ({ id: s.profile.id, name: s.profile.displayName, email: s.profile.email, xp: s.xpTotal, role: s.profile.role, targetLang: s.profile.targetLang, createdAt: s.profile.createdAt })).sort((a, b) => b.xp - a.xp));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [me.profile.timezone]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setRole = async (id: string, role: string) => {
    if (!isSupabaseEnabled) return toast({ title: "Role management requires Supabase", tone: "error" });
    if (id === me.profile.id && role !== "admin" && !confirm("Remove your own admin access?")) return;
    const { error: err } = await supabaseBrowser().from("profiles").update({ role }).eq("id", id);
    if (err) toast({ title: "Couldn't change role", description: err.message, tone: "error" });
    else {
      toast({ title: "Role updated", tone: "success" });
      void load();
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats || !rows) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Learners", stats.learners],
          ["Active (7d)", stats.active_7d],
          ["Lessons completed", stats.lessons_completed],
          ["XP (7d)", stats.xp_7d],
          ["Answers (7d)", stats.attempts_7d],
          ["Accuracy (7d)", stats.accuracy_7d === null ? "–" : `${stats.accuracy_7d}%`],
        ].map(([k, v]) => (
          <Card key={k as string} className="p-4">
            <p className="font-display text-2xl font-extrabold">{v}</p>
            <p className="text-xs font-semibold text-muted">{k}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Active learners per day (14 days)</h2>
          <SimpleBarChart data={stats.daily.map((d) => ({ label: d.day.slice(8), sub: d.day, value: Number(d.learners) }))} unit="learners" title="Active learners per day" />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Hardest exercises</h2>
          {stats.hardest.length === 0 ? (
            <p className="text-sm text-muted">Not enough answers yet (needs 3+ attempts per exercise).</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {stats.hardest.map((h) => (
                <li key={h.exercise_id} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5">
                  <code className="truncate text-xs">{h.exercise_id}</code>
                  <span className="shrink-0 font-semibold">
                    {h.accuracy}% · {h.attempts}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="p-0">
        <h2 className="p-4 font-bold">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="hidden px-4 py-2 md:table-cell">Email</th>
                <th className="px-4 py-2">XP</th>
                <th className="hidden px-4 py-2 sm:table-cell">Learning</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 font-semibold">{r.name}</td>
                  <td className="hidden px-4 py-2 text-muted md:table-cell">{r.email}</td>
                  <td className="px-4 py-2">{r.xp}</td>
                  <td className="hidden px-4 py-2 sm:table-cell">{r.targetLang}</td>
                  <td className="px-4 py-2">
                    <Select aria-label={`Role for ${r.name}`} value={r.role} onChange={(e) => setRole(r.id, e.target.value)} className="h-9 w-28" disabled={!isSupabaseEnabled}>
                      <option value="learner">learner</option>
                      <option value="admin">admin</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const state = useLearnerState();
  const { languages } = useLearner();
  const toast = useToast();
  const [tab, setTab] = React.useState<Tab>("content");
  const [allLangs, setAllLangs] = React.useState<LanguageRow[] | null>(null);

  React.useEffect(() => {
    contentRepo.listLanguages(true).then(setAllLangs).catch(() => setAllLangs(languages));
  }, [languages]);

  if (state.profile.role !== "admin")
    return <EmptyState icon={<ShieldAlert className="h-10 w-10 text-rose-500" />} title="Admins only" description="You don't have permission to view this page." />;
  if (!allLangs) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        subtitle={isSupabaseEnabled ? "Changes are saved to the database and protected by row-level security." : "Local mode: content edits are saved in this browser."}
        action={
          !isSupabaseEnabled ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Reset all content to the built-in course? Your local edits will be lost.")) {
                  resetLocalContent();
                  toast({ title: "Content reset" });
                  window.location.reload();
                }
              }}
            >
              Reset content
            </Button>
          ) : undefined
        }
      />
      <div className="mb-6">
        <Tabs
          label="Admin sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "content", label: "Courses & lessons" },
            { id: "vocab", label: "Vocabulary & audio" },
            { id: "languages", label: "Languages" },
            { id: "learners", label: "Learners & analytics" },
          ]}
        />
      </div>
      {tab === "content" && <ContentTab languages={allLangs} />}
      {tab === "vocab" && <VocabTab />}
      {tab === "languages" && <LanguagesTab />}
      {tab === "learners" && <LearnersTab />}
    </div>
  );
}
