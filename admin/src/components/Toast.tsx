import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

// Global toast store. Pages call useToast.getState().show("...") instead of
// inlining setMessage state — this fixes B5 (silent error swallows) once and
// for all by giving every error path a uniform UX.

type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
  ttlMs: number;
}

interface ToastState {
  toasts: ToastEntry[];
  show: (message: string, variant?: ToastVariant, ttlMs?: number) => void;
  dismiss: (id: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

let nextID = 1;

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, variant = "info", ttlMs = 4000) => {
    const id = nextID++;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, ttlMs }] }));
    if (ttlMs > 0) {
      setTimeout(() => get().dismiss(id), ttlMs);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (message) => get().show(message, "success"),
  error: (message) => get().show(message, "error", 6000),
  info: (message) => get().show(message, "info"),
}));

const VARIANT_STYLES: Record<ToastVariant, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    color: "var(--success)",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.4)",
    icon: <CheckCircle2 size={16} />,
  },
  error: {
    color: "var(--danger)",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.4)",
    icon: <XCircle size={16} />,
  },
  info: {
    color: "var(--accent)",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.4)",
    icon: <AlertCircle size={16} />,
  },
};

/**
 * Toaster renders the active toasts. Mount once at the app root.
 * Bottom-right stacked layout, manual dismiss + auto-expire.
 */
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  // Pause auto-dismiss on hover would be ideal but adds state complexity;
  // 6s for errors gives the user enough time to read.
  return (
    <div
      // insetInlineEnd is direction-aware: it becomes "right" in LTR and
      // "left" in RTL automatically. This keeps the toaster pinned to the
      // trailing edge of the viewport regardless of language.
      style={{
        position: "fixed",
        bottom: 24,
        insetInlineEnd: 24,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const v = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              background: v.bg,
              border: `1px solid ${v.border}`,
              borderRadius: 12,
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              color: v.color,
              fontSize: 13,
              lineHeight: 1.4,
              animation: "toastIn 0.18s ease",
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{v.icon}</span>
            <span style={{ flex: 1, color: "var(--text-1)" }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-3)",
                cursor: "pointer",
                padding: 0,
                marginTop: 1,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      {/* Inject keyframes once. */}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Helper hook for components that want to react to toast events (e.g., focus
 * management). Currently unused but exported for future composition.
 */
export function useToastEvents(onShow?: (t: ToastEntry) => void) {
  const toasts = useToast((s) => s.toasts);
  useEffect(() => {
    const last = toasts[toasts.length - 1];
    if (last && onShow) onShow(last);
  }, [toasts, onShow]);
}
