"use client";
import * as React from "react";
import { isSupabaseEnabled } from "@/lib/config";
import { localChangePassword, localSessionAccount, localSignIn, localSignOut, localSignUp } from "@/lib/data/local-store";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  mode: "supabase" | "local";
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first – check your inbox.";
  if (/already registered/i.test(message)) return "An account with this email already exists.";
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      const acc = localSessionAccount();
      setUser(acc ? { id: acc.id, email: acc.email } : null);
      setReady(true);
      const onStorage = (e: StorageEvent) => {
        if (e.key === "lumrik:session") {
          const a = localSessionAccount();
          setUser(a ? { id: a.id, email: a.email } : null);
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? "" } : null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = React.useMemo<AuthCtx>(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      user,
      ready,
      mode: isSupabaseEnabled ? "supabase" : "local",
      async signUp(email, password, displayName) {
        if (!isSupabaseEnabled) {
          const acc = await localSignUp(email, password, displayName);
          setUser({ id: acc.id, email: acc.email });
          return { needsConfirmation: false };
        }
        const { data, error } = await supabaseBrowser().auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
        });
        if (error) throw new Error(friendly(error.message));
        return { needsConfirmation: !data.session };
      },
      async signIn(email, password) {
        if (!isSupabaseEnabled) {
          const acc = await localSignIn(email, password);
          setUser({ id: acc.id, email: acc.email });
          return;
        }
        const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendly(error.message));
      },
      async signInWithGoogle(next = "/dashboard") {
        if (!isSupabaseEnabled) throw new Error("Google sign-in requires Supabase. Configure it in .env.local (see README).");
        const { error } = await supabaseBrowser().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw new Error(friendly(error.message));
      },
      async signOut() {
        if (!isSupabaseEnabled) localSignOut();
        else await supabaseBrowser().auth.signOut();
        setUser(null);
      },
      async sendPasswordReset(email) {
        if (!isSupabaseEnabled) throw new Error("Password reset emails require Supabase. In local mode, sign in and change your password in Settings.");
        const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
        if (error) throw new Error(friendly(error.message));
      },
      async updatePassword(password) {
        if (!isSupabaseEnabled) {
          if (!user) throw new Error("Not signed in");
          await localChangePassword(user.id, password);
          return;
        }
        const { error } = await supabaseBrowser().auth.updateUser({ password });
        if (error) throw new Error(friendly(error.message));
      },
    };
  }, [user, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
