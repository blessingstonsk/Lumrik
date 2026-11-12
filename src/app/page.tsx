import { BarChart3, Brain, Flame, Layers, MessageCircle, Mic, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { LandingCta, LandingNavActions } from "@/components/landing-cta";
import { Logo } from "@/components/logo";
import { LANGUAGES } from "@/lib/languages";

const FEATURES = [
  { icon: Sparkles, title: "Bite-sized lessons", text: "24 hand-written beginner lessons with 7 interactive exercise types and instant explanations.", color: "text-indigo-500 bg-indigo-500/10" },
  { icon: MessageCircle, title: "AI conversation tutor", text: "Role-play ordering food, job interviews and travel. Get gentle corrections in your native language.", color: "text-emerald-500 bg-emerald-500/10" },
  { icon: Mic, title: "Speaking practice", text: "Speak into your mic and see exactly which words were recognised – honest transcription-based feedback.", color: "text-amber-500 bg-amber-500/10" },
  { icon: Layers, title: "Smart flashcards", text: "Spaced repetition schedules every word you learn, right before you'd forget it.", color: "text-pink-500 bg-pink-500/10" },
  { icon: Brain, title: "Adapts to you", text: "Missed questions come back, weak words get extra review, and every suggestion explains why.", color: "text-sky-500 bg-sky-500/10" },
  { icon: Trophy, title: "Streaks & rewards", text: "XP, daily missions, weekly challenges, achievements and leaderboards keep you coming back.", color: "text-orange-500 bg-orange-500/10" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo href="/" />
          <nav className="flex items-center gap-2" aria-label="Account">
            <LandingNavActions />
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden /> Learn languages smarter
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Speak with confidence, <span className="bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">ten minutes a day.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Lumrik combines playful lessons, spaced repetition, speaking drills and an AI tutor into one learning habit that actually sticks.
            </p>
            <div className="mt-8">
              <LandingCta />
            </div>
            <p className="mt-4 text-sm text-muted">Free · No credit card · Works on phone, tablet and desktop</p>
          </div>

          {/* Product preview card */}
          <div className="relative" aria-hidden>
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-indigo-500/20 via-emerald-400/10 to-amber-400/20 blur-2xl" />
            <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-muted">Lesson 5 · Introducing yourself</span>
                <span className="flex items-center gap-1 text-orange-500">
                  <Flame className="h-4 w-4" fill="currentColor" /> 12
                </span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-surface-2">
                <div className="h-3 w-3/5 rounded-full bg-secondary" />
              </div>
              <p className="mt-6 text-sm font-semibold text-muted">Put the words in the right order</p>
              <div className="mt-3 flex min-h-12 flex-wrap gap-2 border-b-2 border-border pb-3">
                {["My", "name", "is"].map((w) => (
                  <span key={w} className="rounded-xl border-2 border-border px-3 py-1.5 font-semibold">
                    {w}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Ravi", "from", "are"].map((w) => (
                  <span key={w} className="rounded-xl border-2 border-border bg-surface-2 px-3 py-1.5 font-semibold">
                    {w}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-emerald-500/10 p-4">
                <p className="font-display font-extrabold text-emerald-600 dark:text-emerald-400">Great job! +2 XP</p>
                <p className="text-sm text-muted">Name sentence pattern: My name is + name.</p>
              </div>
              <div className="mt-4 rounded-2xl border border-border p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <MessageCircle className="h-4 w-4 text-primary" /> AI tutor
                </p>
                <p className="mt-2 text-sm">
                  <span className="rounded bg-rose-500/10 px-1 line-through">I have 25 years.</span> → <span className="rounded bg-emerald-500/10 px-1">I am 25 years old.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Languages */}
        <section className="border-y border-border bg-surface py-12">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center font-display text-2xl font-extrabold">Built for 11 languages</h2>
            <p className="mt-2 text-center text-sm text-muted">Choose the language you speak and the one you want to learn. English course available now; more courses are being authored.</p>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {LANGUAGES.map((l) => (
                <li key={l.code} className="flex items-center gap-2 rounded-2xl border border-border bg-bg px-4 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-sm font-bold text-primary">{l.glyph}</span>
                  <span>
                    <span className="block text-sm font-bold">{l.nativeName}</span>
                    <span className="block text-xs text-muted">{l.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center font-display text-3xl font-extrabold tracking-tight">Everything you need to actually learn</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, color }) => (
              <div key={title} className="rounded-3xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-gradient-to-br from-indigo-600 to-indigo-500 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center font-display text-3xl font-extrabold">How Lumrik works</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-4">
              {[
                ["1", "Tell us about you", "Your language, goal and how many minutes a day you have."],
                ["2", "Find your level", "Take an optional placement test or start from the beginning."],
                ["3", "Learn daily", "Short lessons, flashcards and speaking drills sized to your goal."],
                ["4", "Use it for real", "Chat with the AI tutor in real-world scenarios."],
              ].map(([n, t, d]) => (
                <li key={n} className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 font-display font-extrabold text-slate-900">{n}</span>
                  <h3 className="mt-4 font-display text-lg font-bold">{t}</h3>
                  <p className="mt-1 text-sm text-indigo-100">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <h2 className="mt-4 font-display text-3xl font-extrabold">Your progress, honestly measured</h2>
          <p className="mt-3 text-muted">Every XP point, streak day and accuracy score comes from what you actually did – never fake numbers.</p>
          <div className="mt-8 flex justify-center">
            <LandingCta />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-muted">
          <Logo href="/" />
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-fg">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-fg">
              Get started
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Lumrik</p>
        </div>
      </footer>
    </div>
  );
}
