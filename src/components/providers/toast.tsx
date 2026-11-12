"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "error";
}
interface ToastCtx {
  toast: (t: Omit<Toast, "id">) => void;
}
const Ctx = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface p-4 shadow-lg",
                t.tone === "error" ? "border-rose-500/40" : t.tone === "success" ? "border-emerald-500/40" : "border-border",
              )}
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.icon && <div className="text-2xl leading-none">{t.icon}</div>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button className="text-muted hover:text-fg" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c.toast;
}
