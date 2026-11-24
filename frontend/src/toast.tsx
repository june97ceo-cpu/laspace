// Global success alerts ("toasts"). Every server action that completes
// successfully pushes one professional notification here via the mutation
// cache subscription in App.tsx, so every button in the app confirms its
// result the same way. Errors keep their existing channels (inline form
// errors and the SDK's bottom failure notice) so nothing is reported twice.

import { useEffect, useState } from "react";
import { Icon } from "./lib";

type Toast = { id: number; title: string; message?: string };

let nextId = 1;
const listeners = new Set<(t: Toast) => void>();

export function pushToast(title: string, message?: string) {
  const toast: Toast = { id: nextId++, title, message };
  listeners.forEach((fn) => fn(toast));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const fn = (t: Toast) => {
      setToasts((prev) => [...prev.slice(-2), t]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3600);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="toast-anim pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--good)",
            boxShadow: "0 12px 32px rgba(3,5,18,0.45)",
          }}
        >
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "var(--good)" }}
          >
            <Icon name="check" size={12} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold" style={{ color: "var(--good)" }}>{t.title}</p>
            {t.message ? <p style={{ color: "var(--dim)" }}>{t.message}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost shrink-0"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Đóng thông báo / Dismiss"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
