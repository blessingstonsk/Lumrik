"use client";
import { motion } from "framer-motion";
import * as React from "react";

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#38BDF8"];

/** Lightweight confetti burst (respects reduced-motion via global CSS). */
export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const items = React.useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 900,
        y: 300 + Math.random() * 500,
        r: Math.random() * 720 - 360,
        d: 1.6 + Math.random() * 1.2,
        c: COLORS[i % COLORS.length],
        s: 6 + Math.random() * 8,
      })),
    [pieces],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {items.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/3 block rounded-sm"
          style={{ width: p.s, height: p.s * 0.6, background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.r }}
          transition={{ duration: p.d, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
