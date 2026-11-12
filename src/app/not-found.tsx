import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl">🧭</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-muted">We couldn&apos;t find that page. Let&apos;s get you back on track.</p>
      <Link href="/dashboard" className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold text-white">
        Go to dashboard
      </Link>
    </main>
  );
}
