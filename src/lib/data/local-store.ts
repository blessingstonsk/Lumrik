"use client";
/**
 * LOCAL MODE storage (used when Supabase isn't configured): accounts and progress live
 * in this browser's localStorage. Passwords are salted + hashed with PBKDF2 (WebCrypto),
 * never stored in plain text. Suitable for evaluation and offline demos – configure
 * Supabase for real multi-device accounts.
 */
import { browserTimezone } from "../dates";
import { emptyLearnerState } from "../engine";
import type { LearnerState, Profile } from "../types";

export interface LocalAccount {
  id: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
}

const ACCOUNTS = "lumrik:accounts";
const SESSION = "lumrik:session";
const stateKey = (id: string) => `lumrik:state:${id}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 120_000, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

export function listAccounts(): LocalAccount[] {
  return read<LocalAccount[]>(ACCOUNTS, []);
}

export async function localSignUp(email: string, password: string, displayName: string) {
  const norm = email.trim().toLowerCase();
  const accounts = listAccounts();
  if (accounts.some((a) => a.email === norm)) throw new Error("An account with this email already exists on this device.");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const account: LocalAccount = { id: crypto.randomUUID(), email: norm, salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
  write(ACCOUNTS, [...accounts, account]);
  const profile: Profile = {
    id: account.id,
    email: norm,
    displayName: displayName.trim().slice(0, 40) || norm.split("@")[0],
    nativeLang: "en",
    targetLang: "en",
    proficiency: "beginner",
    goal: "personal",
    dailyMinutes: 10,
    dailyXpGoal: 20,
    timezone: browserTimezone(),
    // The first account on a device administers local content.
    role: accounts.length === 0 ? "admin" : "learner",
    onboarded: false,
    placementUnit: 1,
    showOnLeaderboard: true,
    theme: "system",
    createdAt: account.createdAt,
  };
  saveLocalState(emptyLearnerState(profile));
  write(SESSION, account.id);
  return account;
}

export async function localSignIn(email: string, password: string) {
  const norm = email.trim().toLowerCase();
  const account = listAccounts().find((a) => a.email === norm);
  if (!account || (await hashPassword(password, account.salt)) !== account.hash) throw new Error("Incorrect email or password.");
  write(SESSION, account.id);
  return account;
}

export async function localChangePassword(userId: string, password: string) {
  const accounts = listAccounts();
  const acc = accounts.find((a) => a.id === userId);
  if (!acc) throw new Error("Account not found");
  acc.salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  acc.hash = await hashPassword(password, acc.salt);
  write(ACCOUNTS, accounts);
}

export function localSignOut() {
  localStorage.removeItem(SESSION);
}

export function localSessionAccount(): LocalAccount | null {
  const id = read<string | null>(SESSION, null);
  return listAccounts().find((a) => a.id === id) ?? null;
}

export function loadLocalState(userId: string): LearnerState | null {
  return read<LearnerState | null>(stateKey(userId), null);
}

export function saveLocalState(state: LearnerState) {
  write(stateKey(state.profile.id), state);
}

export function deleteLocalAccount(userId: string) {
  write(ACCOUNTS, listAccounts().filter((a) => a.id !== userId));
  localStorage.removeItem(stateKey(userId));
  localStorage.removeItem(`lumrik:tutor:${userId}`);
  localSignOut();
}

/** All learner states on this device (for the local leaderboard & admin analytics). */
export function allLocalStates(): LearnerState[] {
  return listAccounts()
    .map((a) => loadLocalState(a.id))
    .filter((s): s is LearnerState => !!s);
}
