/** Runtime configuration. Supabase mode is enabled when both public env vars are set. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const APP_MODE: "supabase" | "local" = isSupabaseEnabled ? "supabase" : "local";
