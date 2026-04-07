import { create } from "zustand";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

// Imperative dialog API. Pages call confirmDialog/promptDialog and await
// the result instead of using native window.confirm/prompt (which look out
// of place against the dark theme and break i18n).

type DialogVariant = "default" | "danger" | "warning";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
}

type DialogState =
  | { kind: "none" }
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (value: string | null) => void };

interface DialogStore {
  current: DialogState;
  set: (s: DialogState) => void;
}

const useDialogStore = create<DialogStore>((set) => ({
  current: { kind: "none" },
  set: (s) => set({ current: s }),
}));

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().set({ kind: "confirm", opts, resolve });
  });
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().set({ kind: "prompt", opts, resolve });
  });
}

const VARIANT_COLORS: Record<DialogVariant, { color: string; bg: string }> = {
  default: { color: "var(--accent)", bg: "rgba(59,130,246,0.1)" },
  danger: { color: "var(--danger)", bg: "rgba(239,68,68,0.1)" },
  warning: { color: "var(--warning)", bg: "rgba(245,158,11,0.1)" },
};

export function DialogHost() {
  const { t } = useTranslation();
  const current = useDialogStore((s) => s.current);
  const setStore = useDialogStore((s) => s.set);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset value whenever a new prompt opens.
  useEffect(() => {
    if (current.kind === "prompt") {
      setValue(current.opts.defaultValue ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [current]);

  // ESC to cancel. The handler closes over `cancel`, but we intentionally
  // depend only on `current` because cancel is recreated every render and
  // including it would re-attach the listener on every render.
  const cancelRef = useRef(() => {});
  cancelRef.current = () => {
    if (current.kind === "confirm") current.resolve(false);
    if (current.kind === "prompt") current.resolve(null);
    setStore({ kind: "none" });
  };
  useEffect(() => {
    if (current.kind === "none") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current]);

  if (current.kind === "none") return null;

  const opts = current.opts;
  const variant = opts.variant ?? "default";
  const v = VARIANT_COLORS[variant];

  function cancel() {
    if (current.kind === "confirm") current.resolve(false);
    if (current.kind === "prompt") current.resolve(null);
    setStore({ kind: "none" });
  }

  function confirm() {
    if (current.kind === "confirm") {
      current.resolve(true);
    } else if (current.kind === "prompt") {
      if (current.opts.required && !value.trim()) return;
      current.resolve(value);
    }
    setStore({ kind: "none" });
  }

  return (
    <>
      <div
        onClick={cancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9998,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog-card"
        style={{
          position: "fixed",
          zIndex: 9999,
          background: "var(--bg-elev-2)",
          border: "1px solid var(--border)",
          padding: 20,
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          animation: "dialogIn 0.18s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {variant !== "default" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              background: v.bg,
              color: v.color,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={18} />
          </div>
        )}
        <h2
          id="dialog-title"
          style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: opts.message ? 6 : 16 }}
        >
          {opts.title}
        </h2>
        {opts.message && (
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.5 }}>
            {opts.message}
          </p>
        )}
        {current.kind === "prompt" && (
          current.opts.multiline ? (
            <textarea
              ref={(el) => { inputRef.current = el; }}
              className="input"
              placeholder={current.opts.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              style={{ marginBottom: 16, resize: "vertical" }}
            />
          ) : (
            <input
              ref={(el) => { inputRef.current = el; }}
              className="input"
              placeholder={current.opts.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
              style={{ marginBottom: 16 }}
            />
          )
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={cancel}>
            {opts.cancelLabel ?? t("common.cancel")}
          </button>
          <button
            className={variant === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={confirm}
            disabled={current.kind === "prompt" && current.opts.required === true && !value.trim()}
          >
            {opts.confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
      <style>{`
        /* Mobile (default): bottom sheet style — snaps to bottom of screen,
           full width, top-rounded. Easier to reach with one thumb. */
        .dialog-card {
          inset-inline: 0;
          bottom: 0;
          width: 100%;
          border-radius: 20px 20px 0 0;
          padding-bottom: calc(20px + var(--safe-bottom));
        }
        @keyframes dialogIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Tablet+ (md): centered modal, max-width 440. */
        @media (min-width: 640px) {
          .dialog-card {
            inset: auto;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(480px, calc(100vw - 32px));
            border-radius: 16px;
            padding-bottom: 20px;
          }
          @keyframes dialogIn {
            from { opacity: 0; transform: translate(-50%, -48%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        }
      `}</style>
    </>
  );
}
