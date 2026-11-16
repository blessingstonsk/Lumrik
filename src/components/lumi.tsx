"use client";
/**
 * Lumi – Lumrik's original mascot: a small glowing creature with a lantern antenna.
 * Pure SVG + framer-motion, so it scales crisply and needs no image assets.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

export type LumiMood = "idle" | "happy" | "sad" | "thinking" | "talking" | "celebrate" | "wave";

export function Lumi({ mood = "idle", size = 96, className, label }: { mood?: LumiMood; size?: number; className?: string; label?: string }) {
  const id = React.useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2600 + Math.random() * 2400);
    };
    loop();
    return () => clearTimeout(t);
  }, [reduce]);

  const happy = mood === "happy" || mood === "celebrate";
  const body = {
    idle: { y: [0, -4, 0], rotate: 0, transition: { repeat: Infinity, duration: 3, ease: "easeInOut" } },
    talking: { y: [0, -3, 0], rotate: 0, transition: { repeat: Infinity, duration: 1.6, ease: "easeInOut" } },
    thinking: { y: [0, -2, 0], rotate: [-4, 4, -4], transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" } },
    happy: { y: [0, -12, 0], rotate: 0, transition: { repeat: 2, duration: 0.45, ease: "easeOut" } },
    celebrate: { y: [0, -18, 0], rotate: [0, -6, 6, 0], transition: { repeat: Infinity, duration: 0.7, ease: "easeOut" } },
    sad: { y: 2, rotate: -6, transition: { duration: 0.4 } },
    wave: { y: [0, -4, 0], rotate: 0, transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" } },
  }[mood];

  const armUp = mood === "celebrate";
  const waving = mood === "wave";

  return (
    <motion.svg
      viewBox="0 0 120 130"
      width={size}
      height={(size * 130) / 120}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={label ?? `Lumi the mascot, looking ${mood === "idle" ? "friendly" : mood}`}
      animate={reduce ? undefined : (body as never)}
    >
      <defs>
        <radialGradient id={`b${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#A5B4FC" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </radialGradient>
        <radialGradient id={`g${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="60" cy="124" rx={mood === "celebrate" ? 22 : 30} ry="4" fill="#0F172A" opacity="0.12" />

      {/* antenna + lantern glow */}
      <path d="M60 34 Q58 22 64 14" stroke="#4338CA" strokeWidth="3" fill="none" strokeLinecap="round" />
      <motion.circle cx="65" cy="12" r="14" fill={`url(#g${id})`} animate={reduce ? undefined : { opacity: mood === "thinking" ? [0.4, 1, 0.4] : [0.6, 0.9, 0.6] }} transition={{ repeat: Infinity, duration: mood === "thinking" ? 0.9 : 2.4 }} />
      <circle cx="65" cy="12" r="6" fill="#F59E0B" stroke="#FBBF24" strokeWidth="2" />

      {/* feet */}
      <ellipse cx="45" cy="114" rx="10" ry="6" fill="#4338CA" />
      <ellipse cx="75" cy="114" rx="10" ry="6" fill="#4338CA" />

      {/* arms */}
      <motion.ellipse
        cx="20" cy="78" rx="8" ry="13" fill="#4F46E5"
        style={{ originX: "28px", originY: "70px" }}
        animate={reduce ? undefined : { rotate: armUp ? -140 : mood === "sad" ? 15 : 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
      />
      <motion.ellipse
        cx="100" cy="78" rx="8" ry="13" fill="#4F46E5"
        style={{ originX: "92px", originY: "70px" }}
        animate={reduce ? undefined : waving ? { rotate: [-150, -110, -150] } : { rotate: armUp ? 140 : mood === "sad" ? -15 : -20 }}
        transition={waving ? { repeat: Infinity, duration: 0.7 } : { type: "spring", stiffness: 200, damping: 12 }}
      />

      {/* body */}
      <ellipse cx="60" cy="74" rx="42" ry="42" fill={`url(#b${id})`} />
      <ellipse cx="60" cy="90" rx="24" ry="18" fill="#E0E7FF" opacity="0.55" />
      <ellipse cx="44" cy="50" rx="10" ry="6" fill="#fff" opacity="0.35" transform="rotate(-25 44 50)" />

      {/* cheeks */}
      <circle cx="33" cy="80" r="6" fill="#F472B6" opacity={happy ? 0.7 : 0.4} />
      <circle cx="87" cy="80" r="6" fill="#F472B6" opacity={happy ? 0.7 : 0.4} />

      {/* eyebrows (sad / thinking) */}
      {mood === "sad" && (
        <g stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round">
          <path d="M37 54 L50 58" />
          <path d="M83 54 L70 58" />
        </g>
      )}

      {/* eyes */}
      {happy ? (
        <g stroke="#1E1B4B" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M37 70 Q45 59 53 70" />
          <path d="M67 70 Q75 59 83 70" />
        </g>
      ) : (
        <g>
          <ellipse cx="45" cy="68" rx="10" ry={blink ? 1.5 : 12} fill="#fff" />
          <ellipse cx="75" cy="68" rx="10" ry={blink ? 1.5 : 12} fill="#fff" />
          {!blink && (
            <>
              <circle cx={mood === "thinking" ? 48 : 46} cy={mood === "thinking" ? 63 : mood === "sad" ? 72 : 69} r="6" fill="#1E1B4B" />
              <circle cx={mood === "thinking" ? 78 : 76} cy={mood === "thinking" ? 63 : mood === "sad" ? 72 : 69} r="6" fill="#1E1B4B" />
              <circle cx={mood === "thinking" ? 50 : 48} cy={mood === "thinking" ? 61 : 67} r="2" fill="#fff" />
              <circle cx={mood === "thinking" ? 80 : 78} cy={mood === "thinking" ? 61 : 67} r="2" fill="#fff" />
            </>
          )}
        </g>
      )}

      {/* mouth */}
      {mood === "talking" ? (
        <motion.ellipse cx="60" cy="88" rx="7" fill="#1E1B4B" animate={reduce ? { ry: 4 } : { ry: [2, 6, 3, 7, 2] }} transition={{ repeat: Infinity, duration: 0.6 }} />
      ) : happy ? (
        <path d="M48 84 Q60 100 72 84 Z" fill="#1E1B4B" />
      ) : mood === "sad" ? (
        <path d="M51 92 Q60 84 69 92" stroke="#1E1B4B" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <circle cx="64" cy="89" r="3.5" fill="#1E1B4B" />
      ) : (
        <path d="M51 86 Q60 94 69 86" stroke="#1E1B4B" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}

      {/* celebration sparkles */}
      <AnimatePresence>
        {mood === "celebrate" &&
          [
            [8, 30, "#F59E0B"],
            [112, 34, "#10B981"],
            [16, 100, "#EC4899"],
            [106, 100, "#38BDF8"],
          ].map(([x, y, c], i) => (
            <motion.path
              key={i}
              d={`M${x} ${Number(y) - 6} L${Number(x) + 2} ${Number(y) - 2} L${Number(x) + 6} ${y} L${Number(x) + 2} ${Number(y) + 2} L${x} ${Number(y) + 6} L${Number(x) - 2} ${Number(y) + 2} L${Number(x) - 6} ${y} L${Number(x) - 2} ${Number(y) - 2} Z`}
              fill={String(c)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 0.8], opacity: [0, 1, 0.6] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
              style={{ originX: `${x}px`, originY: `${y}px` }}
            />
          ))}
      </AnimatePresence>
    </motion.svg>
  );
}

/** Lumi with a speech bubble. */
export function LumiSays({
  mood = "idle",
  children,
  size = 72,
  side = "right",
  className,
  onClick,
}: {
  mood?: LumiMood;
  children: React.ReactNode;
  size?: number;
  side?: "right" | "left";
  className?: string;
  onClick?: () => void;
}) {
  const lumi = onClick ? (
    <button type="button" onClick={onClick} className="shrink-0 rounded-full transition hover:scale-105" aria-label="Talk to Lumi">
      <Lumi mood={mood} size={size} />
    </button>
  ) : (
    <Lumi mood={mood} size={size} className="shrink-0" />
  );
  return (
    <div className={cn("flex items-end gap-3", side === "left" && "flex-row-reverse", className)}>
      {lumi}
      <motion.div
        key={typeof children === "string" ? children : undefined}
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative mb-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold shadow-sm",
          side === "right" ? "rounded-bl-sm" : "rounded-br-sm",
        )}
        aria-live="polite"
      >
        {children}
      </motion.div>
    </div>
  );
}
