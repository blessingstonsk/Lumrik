import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="lumrik-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="url(#lumrik-g)" />
      <path d="M40 34v52h40" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="88" cy="40" r="10" fill="#F59E0B" />
    </svg>
  );
}

export function Logo({ compact = false, href = "/dashboard" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Lumrik home">
      <LogoMark />
      {!compact && <span className="font-display text-xl font-extrabold tracking-tight">Lumrik</span>}
    </Link>
  );
}
