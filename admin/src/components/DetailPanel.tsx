import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DetailPanel({ open, onClose, title, subtitle, actions, children }: DetailPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 end-0 z-[101] flex w-full max-w-2xl flex-col border-s"
        style={{
          background: "var(--bg)",
          borderColor: "var(--border)",
          animation: "slideIn 0.2s ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-3)" }}
          >
            <X size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// Reusable detail section
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-3)" }}>{title}</h3>
      {children}
    </div>
  );
}

// Reusable key-value row
export function DetailRow({ label, value, mono, badge }: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  badge?: { color: string; bg: string };
}) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-3)" }}>{label}</span>
      {badge ? (
        <span className="badge" style={{ background: badge.bg, color: badge.color }}>{value}</span>
      ) : (
        <span className={`text-sm ${mono ? "font-mono" : ""}`} style={{ color: "var(--text-1)" }}>{value}</span>
      )}
    </div>
  );
}
