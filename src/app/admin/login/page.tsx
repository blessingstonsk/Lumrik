"use client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LogoMark } from "@/components/logo";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { isSupabaseEnabled } from "@/lib/config";
import { localAdminExists, localRoleOf } from "@/lib/data/local-store";
import { supabaseBrowser } from "@/lib/supabase/client";

async function roleOf(userId: string): Promise<string> {
  if (!isSupabaseEnabled) return localRoleOf(userId);
  const { data } = await supabaseBrowser().from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? "learner";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Separate sign-in for administrators. Learner accounts are refused here. */
export default function AdminLoginPage() {
  const { signIn, signUp, signOut, user, ready } = useAuth();
  const router = useRouter();
  const [setupMode, setSetupMode] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  // Already signed in as an admin? Go straight to the portal.
  React.useEffect(() => {
    if (!ready) return;
    if (!isSupabaseEnabled) setSetupMode(!localAdminExists());
    if (!user) return setChecking(false);
    roleOf(user.id)
      .then((r) => (r === "admin" ? router.replace("/admin") : setChecking(false)))
      .catch(() => setChecking(false));
  }, [ready, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (setupMode) {
      if (!name.trim()) return setError("Enter your name.");
      if (password.length < 10 || !/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) return setError("Admin passwords need at least 10 characters, with letters and a number.");
    } else if (!password) return setError("Enter your password.");

    setLoading(true);
    try {
      if (setupMode) {
        await signUp(email, password, name, "admin");
        router.replace("/admin");
        return;
      }
      if (user) await signOut(); // switch accounts cleanly
      await signIn(email, password);
      const id = isSupabaseEnabled ? (await supabaseBrowser().auth.getUser()).data.user?.id : localSessionId();
      const role = id ? await roleOf(id) : "learner";
      if (role !== "admin") {
        await signOut();
        throw new Error("This account doesn't have admin access. Learners sign in on the regular login page.");
      }
      router.replace("/admin");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4 py-10 text-slate-100">
      <main id="main" className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="font-display text-xl font-extrabold">Lumrik</p>
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin portal
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-800 p-7 shadow-2xl">
          <h1 className="font-display text-2xl font-extrabold">{setupMode ? "Create the admin account" : "Administrator sign in"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {setupMode
              ? "No administrator exists on this device yet. The account you create here manages courses, lessons, vocabulary and learners."
              : "For content managers and site administrators only."}
          </p>
          {checking ? (
            <p className="mt-6 text-sm text-slate-400">Checking your session…</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4 [&_input]:border-slate-600 [&_input]:bg-slate-900 [&_input]:text-slate-100 [&_label]:text-slate-200" noValidate>
              {setupMode && (
                <Field label="Name" htmlFor="a-name">
                  <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
                </Field>
              )}
              <Field label="Admin email" htmlFor="a-email">
                <Input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </Field>
              <Field label="Password" htmlFor="a-password" hint={setupMode ? "At least 10 characters, with letters and a number." : undefined}>
                <Input id="a-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setupMode ? "new-password" : "current-password"} />
              </Field>
              {error && (
                <p role="alert" className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-300">
                  {error}
                </p>
              )}
              <Button type="submit" block size="lg" loading={loading}>
                {setupMode ? "Create admin account" : "Sign in to admin"}
              </Button>
            </form>
          )}
          {isSupabaseEnabled && !setupMode && (
            <p className="mt-5 text-xs text-slate-400">
              Admin access is granted by setting <code className="rounded bg-slate-900 px-1">role = &apos;admin&apos;</code> on the user&apos;s profile in Supabase (see README).
            </p>
          )}
        </div>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Learner sign in
        </Link>
      </main>
    </div>
  );
}

function localSessionId(): string | undefined {
  try {
    return JSON.parse(localStorage.getItem("lumrik:session") ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}
