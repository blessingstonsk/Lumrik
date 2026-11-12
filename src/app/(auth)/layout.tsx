import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-emerald-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo href="/" />
        <div>
          <p className="font-display text-4xl font-extrabold leading-tight">
            Learn a language
            <br />a few minutes a day.
          </p>
          <p className="mt-4 max-w-md text-indigo-100">Interactive lessons, spaced-repetition flashcards, pronunciation practice and an AI tutor that explains your mistakes.</p>
          <div className="mt-8 flex flex-wrap gap-2 text-2xl" aria-hidden>
            {["Hello", "வணக்கம்", "नमस्ते", "നമസ്കാരം", "నమస్కారం", "ನಮಸ್ಕಾರ", "Bonjour", "Hola", "Hallo", "こんにちは", "안녕하세요"].map((g) => (
              <span key={g} className="rounded-full bg-white/15 px-3 py-1 text-base font-semibold backdrop-blur">
                {g}
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm text-indigo-100">© {new Date().getFullYear()} Lumrik</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 right-20 h-72 w-72 rounded-full bg-amber-400/20" />
      </div>
      <main id="main" className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo href="/" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
