"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  BookMarked,

  Flame,
  Globe2,
  Home,
  Layers,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Mic,
  Settings,
  Shield,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/components/providers/auth";
import { useLearner } from "@/components/providers/learner";
import { ErrorState, PageSkeleton, Spinner } from "@/components/ui/misc";
import { dayKey } from "@/lib/dates";
import { computeStreak } from "@/lib/gamification";
import { getLanguage } from "@/lib/languages";
import { cn, formatNumber } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: Map },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/tutor", label: "AI Tutor", icon: MessageCircle },
  { href: "/speaking", label: "Speaking", icon: Mic },
  { href: "/vocabulary", label: "Vocabulary", icon: BookMarked },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Users },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/languages", label: "Languages", icon: Globe2 },
  { href: "/settings", label: "Settings", icon: Settings },
];
const MOBILE = ["/dashboard", "/learn", "/flashcards", "/tutor"];

/** Redirects anonymous users to /login and un-onboarded users to /onboarding. */
export function RequireAuth({ children, allowUnonboarded = false }: { children: React.ReactNode; allowUnonboarded?: boolean }) {
  const { user, ready } = useAuth();
  const { state, loading, error, reload } = useLearner();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  React.useEffect(() => {
    if (state && !state.profile.onboarded && !allowUnonboarded) router.replace("/onboarding");
  }, [state, allowUnonboarded, router]);

  if (!ready || !user || (loading && !state)) return <Spinner className="min-h-dvh" label="Loading your account" />;
  if (error && !state)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  if (!state || (!state.profile.onboarded && !allowUnonboarded)) return <Spinner className="min-h-dvh" />;
  return <>{children}</>;
}

function StatsPills() {
  const { state } = useLearner();
  if (!state) return null;
  const streak = computeStreak(state.activity, dayKey(new Date(), state.profile.timezone));
  const lang = getLanguage(state.profile.targetLang);
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <Link href="/languages" className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-surface-2" title={`Learning ${lang.name}`}>
        <span aria-hidden>{lang.flag}</span>
        <span className="sr-only">Learning {lang.name}</span>
      </Link>
      <span className={cn("flex items-center gap-1 rounded-full px-2 py-1", streak.activeToday ? "text-orange-500" : "text-muted")} title="Day streak">
        <Flame className="h-4 w-4" aria-hidden fill={streak.activeToday ? "currentColor" : "none"} />
        {streak.current}
        <span className="sr-only">day streak</span>
      </span>
      <span className="flex items-center gap-1 rounded-full px-2 py-1 text-amber-500" title="Total XP">
        <Zap className="h-4 w-4" aria-hidden fill="currentColor" />
        {formatNumber(state.xpTotal)}
        <span className="sr-only">XP</span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut, mode } = useAuth();
  const { state } = useLearner();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const isAdmin = state?.profile.role === "admin";
  const items = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  React.useEffect(() => setMoreOpen(false), [pathname]);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh md:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex" aria-label="Main navigation">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active(href) ? "bg-indigo-500/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          {mode === "local" && <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Local mode: data is stored in this browser.</p>}
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg">
            <LogOut className="h-5 w-5" aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur md:px-8">
        <div className="md:hidden">
          <Logo compact />
        </div>
        <div className="hidden text-sm text-muted md:block">
          {state ? (
            <>
              Hi, <span className="font-semibold text-fg">{state.profile.displayName}</span> 👋
            </>
          ) : null}
        </div>
        <StatsPills />
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <React.Suspense fallback={<PageSkeleton />}>{children}</React.Suspense>
          </motion.div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main navigation">
        <div className="grid grid-cols-5">
          {MOBILE.map((href) => {
            const item = NAV.find((n) => n.href === href)!;
            const Icon = item.icon;
            return (
              <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", active(href) ? "text-primary" : "text-muted")}>
                <Icon className="h-6 w-6" aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted" aria-haspopup="dialog" aria-expanded={moreOpen}>
            <Menu className="h-6 w-6" aria-hidden />
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More pages"
              className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg font-bold">More</span>
                <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className="rounded-lg p-1 hover:bg-surface-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items
                  .filter((i) => !MOBILE.includes(i.href))
                  .map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 p-3 text-xs font-semibold">
                      <Icon className="h-6 w-6 text-primary" aria-hidden />
                      {label}
                    </Link>
                  ))}
                <button onClick={logout} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2 p-3 text-xs font-semibold">
                  <LogOut className="h-6 w-6 text-rose-500" aria-hidden />
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NoCourseNotice() {
  const { state } = useLearner();
  const lang = getLanguage(state?.profile.targetLang);
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="text-4xl">{lang.flag}</div>
      <h2 className="mt-2 font-display text-lg font-bold">The {lang.name} course is coming soon</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Lumrik only publishes courses authored and reviewed by people – no machine-generated placeholder translations. Meanwhile you can practise {lang.name} with the AI tutor, or switch to English.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/tutor" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          Practise with the AI tutor
        </Link>
        <Link href="/languages" className="rounded-xl border-2 border-border px-4 py-2 text-sm font-semibold">
          Change language
        </Link>
      </div>
    </div>
  );
}

