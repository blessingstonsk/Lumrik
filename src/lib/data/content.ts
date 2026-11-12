"use client";
/**
 * Content repository. Supabase mode reads (and, for admins, writes) Postgres through RLS.
 * Local mode uses the built-in course, with admin edits saved in this browser.
 */
import { BUILTIN, PLACEMENT_BY_COURSE } from "@/content";
import { isSupabaseEnabled } from "../config";
import { LANGUAGES } from "../languages";
import { supabaseBrowser } from "../supabase/client";
import { fromExercise, fromLanguage, fromVocab, toCourse, toLanguage, toLesson, toVocab } from "../supabase/mappers";
import type { Course, Language, Lesson, PlacementQuestion, Unit, VocabWord } from "../types";

export type LanguageRow = Language & { glyph: string };

export interface ContentRepo {
  listLanguages(includeDisabled?: boolean): Promise<LanguageRow[]>;
  listCourses(includeUnpublished?: boolean): Promise<Course[]>;
  getCourseForLang(lang: string): Promise<Course | null>;
  getLesson(id: string): Promise<Lesson | null>;
  getVocabulary(courseId: string): Promise<VocabWord[]>;
  getPlacement(courseId: string): Promise<PlacementQuestion[]>;
  // admin
  saveLanguage(l: LanguageRow): Promise<void>;
  saveCourse(c: Omit<Course, "units">): Promise<void>;
  saveUnit(u: Omit<Unit, "lessons">): Promise<void>;
  saveLesson(l: Lesson): Promise<void>;
  deleteLesson(id: string): Promise<void>;
  setPublished(kind: "course" | "unit" | "lesson", id: string, published: boolean): Promise<void>;
  saveWord(w: VocabWord): Promise<void>;
  deleteWord(id: string): Promise<void>;
  uploadAudio(file: File, wordId: string): Promise<string>;
}

// ── Local (browser) implementation ──────────────────────────
interface LocalContent {
  languages: LanguageRow[];
  courses: Course[];
  lessons: Lesson[];
  vocab: VocabWord[];
}
const KEY = "lumrik:content:v1";

function readLocal(): LocalContent {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return structuredClone({ languages: LANGUAGES, courses: BUILTIN.courses, lessons: BUILTIN.lessons, vocab: BUILTIN.vocab });
}
function writeLocal(c: LocalContent) {
  localStorage.setItem(KEY, JSON.stringify(c));
}
function syncSummaries(c: LocalContent) {
  for (const course of c.courses)
    for (const unit of course.units)
      unit.lessons = c.lessons
        .filter((l) => l.unitId === unit.id)
        .sort((a, b) => a.order - b.order)
        .map(({ exercises, tip: _t, ...s }) => ({ ...s, exerciseCount: exercises.length }));
}

const localRepo: ContentRepo = {
  async listLanguages(all) {
    return readLocal().languages.filter((l) => all || l.enabled);
  },
  async listCourses(all) {
    return readLocal().courses.filter((c) => all || c.published);
  },
  async getCourseForLang(lang) {
    const c = readLocal().courses.find((x) => x.targetLang === lang && x.published);
    if (!c) return null;
    return { ...c, units: c.units.filter((u) => u.published).map((u) => ({ ...u, lessons: u.lessons.filter((l) => l.published) })) };
  },
  async getLesson(id) {
    return readLocal().lessons.find((l) => l.id === id) ?? null;
  },
  async getVocabulary(courseId) {
    return readLocal().vocab.filter((v) => v.courseId === courseId);
  },
  async getPlacement(courseId) {
    return PLACEMENT_BY_COURSE[courseId] ?? [];
  },
  async saveLanguage(l) {
    const c = readLocal();
    const i = c.languages.findIndex((x) => x.code === l.code);
    if (i >= 0) c.languages[i] = l;
    else c.languages.push(l);
    writeLocal(c);
  },
  async saveCourse(course) {
    const c = readLocal();
    const i = c.courses.findIndex((x) => x.id === course.id);
    if (i >= 0) c.courses[i] = { ...c.courses[i], ...course };
    else c.courses.push({ ...course, units: [] });
    writeLocal(c);
  },
  async saveUnit(unit) {
    const c = readLocal();
    const course = c.courses.find((x) => x.id === unit.courseId);
    if (!course) throw new Error("Course not found");
    const i = course.units.findIndex((u) => u.id === unit.id);
    if (i >= 0) course.units[i] = { ...course.units[i], ...unit };
    else course.units.push({ ...unit, lessons: [] });
    course.units.sort((a, b) => a.order - b.order);
    writeLocal(c);
  },
  async saveLesson(lesson) {
    const c = readLocal();
    const i = c.lessons.findIndex((x) => x.id === lesson.id);
    const l = { ...lesson, exerciseCount: lesson.exercises.length };
    if (i >= 0) c.lessons[i] = l;
    else c.lessons.push(l);
    syncSummaries(c);
    writeLocal(c);
  },
  async deleteLesson(id) {
    const c = readLocal();
    c.lessons = c.lessons.filter((l) => l.id !== id);
    syncSummaries(c);
    writeLocal(c);
  },
  async setPublished(kind, id, published) {
    const c = readLocal();
    if (kind === "course") c.courses.forEach((x) => x.id === id && (x.published = published));
    if (kind === "unit") c.courses.forEach((x) => x.units.forEach((u) => u.id === id && (u.published = published)));
    if (kind === "lesson") c.lessons.forEach((l) => l.id === id && (l.published = published));
    syncSummaries(c);
    writeLocal(c);
  },
  async saveWord(w) {
    const c = readLocal();
    const i = c.vocab.findIndex((x) => x.id === w.id);
    if (i >= 0) c.vocab[i] = w;
    else c.vocab.push(w);
    writeLocal(c);
  },
  async deleteWord(id) {
    const c = readLocal();
    c.vocab = c.vocab.filter((x) => x.id !== id);
    writeLocal(c);
  },
  async uploadAudio(file) {
    if (file.size > 1_500_000) throw new Error("In local mode, audio files must be under 1.5 MB");
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
  },
};

// ── Supabase implementation ─────────────────────────────────
function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
const COURSE_SELECT = "*, units(*, lessons(id, unit_id, position, title, description, xp_reward, published, exercises(count)))";

const supabaseRepo: ContentRepo = {
  async listLanguages(all) {
    let q = supabaseBrowser().from("languages").select("*").order("name");
    if (!all) q = q.eq("enabled", true);
    return (ok(await q) ?? []).map(toLanguage);
  },
  async listCourses() {
    // RLS decides visibility: learners see published rows, admins see everything.
    return (ok(await supabaseBrowser().from("courses").select(COURSE_SELECT).order("title")) ?? []).map(toCourse);
  },
  async getCourseForLang(lang) {
    const rows = ok(await supabaseBrowser().from("courses").select(COURSE_SELECT).eq("target_lang", lang).eq("published", true).limit(1));
    if (!rows?.length) return null;
    const c = toCourse(rows[0]);
    return { ...c, units: c.units.filter((u) => u.published).map((u) => ({ ...u, lessons: u.lessons.filter((l) => l.published) })) };
  },
  async getLesson(id) {
    const row = ok(await supabaseBrowser().from("lessons").select("*, exercises(*)").eq("id", id).maybeSingle());
    return row ? toLesson(row) : null;
  },
  async getVocabulary(courseId) {
    return (ok(await supabaseBrowser().from("vocabulary").select("*").eq("course_id", courseId).order("id")) ?? []).map(toVocab);
  },
  async getPlacement(courseId) {
    return PLACEMENT_BY_COURSE[courseId] ?? [];
  },
  async saveLanguage(l) {
    ok(await supabaseBrowser().from("languages").upsert(fromLanguage(l)));
  },
  async saveCourse(c) {
    ok(await supabaseBrowser().from("courses").upsert({ id: c.id, target_lang: c.targetLang, title: c.title, description: c.description, published: c.published }));
  },
  async saveUnit(u) {
    ok(await supabaseBrowser().from("units").upsert({ id: u.id, course_id: u.courseId, position: u.order, title: u.title, description: u.description, cefr: u.cefr, icon: u.icon, published: u.published }));
  },
  async saveLesson(l) {
    const sb = supabaseBrowser();
    ok(await sb.from("lessons").upsert({ id: l.id, unit_id: l.unitId, position: l.order, title: l.title, description: l.description, tip: l.tip ?? null, xp_reward: l.xpReward, published: l.published }));
    const keep = l.exercises.map((e) => e.id);
    const existing = ok(await sb.from("exercises").select("id").eq("lesson_id", l.id)) ?? [];
    const remove = existing.map((r: { id: string }) => r.id).filter((id: string) => !keep.includes(id));
    if (remove.length) ok(await sb.from("exercises").delete().in("id", remove));
    if (l.exercises.length) ok(await sb.from("exercises").upsert(l.exercises.map(fromExercise)));
  },
  async deleteLesson(id) {
    ok(await supabaseBrowser().from("lessons").delete().eq("id", id));
  },
  async setPublished(kind, id, published) {
    const table = kind === "course" ? "courses" : kind === "unit" ? "units" : "lessons";
    ok(await supabaseBrowser().from(table).update({ published }).eq("id", id));
  },
  async saveWord(w) {
    ok(await supabaseBrowser().from("vocabulary").upsert(fromVocab(w)));
  },
  async deleteWord(id) {
    ok(await supabaseBrowser().from("vocabulary").delete().eq("id", id));
  },
  async uploadAudio(file, wordId) {
    const sb = supabaseBrowser();
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `vocab/${wordId}-${Date.now()}.${ext}`;
    ok(await sb.storage.from("audio").upload(path, file, { contentType: file.type || "audio/mpeg", upsert: true }));
    return sb.storage.from("audio").getPublicUrl(path).data.publicUrl;
  },
};

export const contentRepo: ContentRepo = isSupabaseEnabled ? supabaseRepo : localRepo;

export function resetLocalContent() {
  localStorage.removeItem(KEY);
}
