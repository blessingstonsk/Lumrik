"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl">😵</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">An unexpected error occurred. Your progress is safe – try again.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold text-white">
        Try again
      </button>
    </main>
  );
}
