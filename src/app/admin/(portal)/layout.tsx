"use client";
import { ExternalLink, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LogoMark } from "@/components/logo";
import { useAuth } from "@/components/providers/auth";
import { useLearner } from "@/components/providers/learner";
import { Button } from "@/components/ui/button";
import { ErrorState, Spinner } from "@/components/ui/misc";

/** Admin portal shell: only administrators get past this guard; everyone else goes to the admin login. */
export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const { state, loading, error, reload } = useLearner();
  const router = useRouter();

  React.useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const logout = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  if (!ready || !user || (loading && !state)) return <Spinner className="min-h-dvh" label="Checking admin access" />;
  if (error && !state)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  if (state && state.profile.role !== "admin")
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h1 className="font-display text-2xl font-extrabold">Admins only</h1>
        <p className="max-w-sm text-sm text-muted">You&apos;re signed in as a learner. Sign in with an administrator account to manage Lumrik.</p>
        <div className="mt-2 flex gap-2">
          <Button onClick={logout}>Switch to admin account</Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to learning
          </Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
          <Link href="/admin" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-lg font-extrabold">Lumrik</span>
            <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-400 sm:inline">{user.email}</span>
            <Link href="/" target="_blank" className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 sm:flex">
              <ExternalLink className="h-4 w-4" /> View site
            </Link>
            <button onClick={logout} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {children}
      </main>
    </div>
  );
}
