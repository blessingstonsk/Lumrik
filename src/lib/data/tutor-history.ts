"use client";
/** AI tutor conversation history: Postgres (RLS: owner only) in Supabase mode, localStorage otherwise. */
import { isSupabaseEnabled } from "../config";
import { supabaseBrowser } from "../supabase/client";
import type { TutorMessage } from "../tutor";

export interface Conversation {
  id: string;
  scenario: string;
  targetLang: string;
  level: string;
  messages: TutorMessage[];
  updatedAt: string;
}

const localKey = (userId: string) => `lumrik:tutor:${userId}`;
function readLocal(userId: string): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}
function writeLocal(userId: string, list: Conversation[]) {
  localStorage.setItem(localKey(userId), JSON.stringify(list.slice(0, 30)));
}

export async function latestConversation(userId: string, scenario: string, targetLang: string): Promise<Conversation | null> {
  if (!isSupabaseEnabled) return readLocal(userId).find((c) => c.scenario === scenario && c.targetLang === targetLang) ?? null;
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("tutor_conversations")
    .select("id, scenario, target_lang, level, updated_at, tutor_messages(role, content, created_at)")
    .eq("user_id", userId)
    .eq("scenario", scenario)
    .eq("target_lang", targetLang)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  const msgs = (row.tutor_messages as { role: "user" | "assistant"; content: string; created_at: string }[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { id: row.id, scenario: row.scenario, targetLang: row.target_lang, level: row.level, updatedAt: row.updated_at, messages: msgs.map(({ role, content }) => ({ role, content })) };
}

export async function createConversation(userId: string, scenario: string, targetLang: string, level: string): Promise<Conversation> {
  const now = new Date().toISOString();
  if (!isSupabaseEnabled) {
    const c: Conversation = { id: crypto.randomUUID(), scenario, targetLang, level, messages: [], updatedAt: now };
    writeLocal(userId, [c, ...readLocal(userId)]);
    return c;
  }
  const { data, error } = await supabaseBrowser().from("tutor_conversations").insert({ user_id: userId, scenario, target_lang: targetLang, level, title: scenario }).select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, scenario, targetLang, level, messages: [], updatedAt: data.updated_at };
}

export async function appendMessages(userId: string, conversationId: string, messages: TutorMessage[]) {
  if (!isSupabaseEnabled) {
    const list = readLocal(userId);
    const c = list.find((x) => x.id === conversationId);
    if (c) {
      c.messages.push(...messages);
      c.updatedAt = new Date().toISOString();
      writeLocal(userId, [c, ...list.filter((x) => x.id !== conversationId)]);
    }
    return;
  }
  const sb = supabaseBrowser();
  const { error } = await sb.from("tutor_messages").insert(messages.map((m) => ({ conversation_id: conversationId, user_id: userId, role: m.role, content: m.content.slice(0, 8000) })));
  if (error) throw new Error(error.message);
  await sb.from("tutor_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}
