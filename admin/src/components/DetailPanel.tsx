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

// DetailPanel adapts to the viewport:
//   - On screens >= md (768px), it slides in from the trailing edge as a
//     desktop slide-over panel (max 640px wide).
//   - On mobile, it becomes a full-screen sheet that slides up from the
//     bottom, with a sticky header (back button) and a sticky bottom action
//     bar so the primary actions remain reachable above the keyboard.
//
// Both modes support: ESC to close, backdrop tap to close, body scroll lock
// while open.

export function DetailPanel({ open, onClose, title, subtitle, actions, children }: DetailPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock — prevents the page underneath from scrolling.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — both desktop and mobile */}
      <div
        className="fixed inset-0 z-[100]"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }}
        onClick={onClose}
      />

      {/* Panel — full screen on mobile, slide-over on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed z-[101] flex flex-col"
        style={{
          // Mobile defaults: full-screen sheet from the bottom
          inset: 0,
          background: "var(--bg)",
          paddingTop: "var(--safe-top)",
          // Animations are direction-aware: slide up on mobile, slide-in
          // from trailing edge on desktop. We rely on a media query in the
          // <style> below to swap which keyframes apply.
          animation: "sheetUp 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Header — sticky to top so back button stays visible while scrolling */}
        <div
          className="flex items-center gap-3 border-b px-4 md:px-6 py-3 md:py-4 sticky top-0"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            zIndex: 5,
            minHeight: 56,
          }}
        >
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold truncate" style={{ color: "var(--text-1)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {/* Desktop: actions in the header. Mobile: they move to a sticky
              footer (rendered below) so they don't get hidden by the keyboard
              and stay reachable. */}
          {actions && (
            <div className="hidden md:flex gap-2 flex-shrink-0">{actions}</div>
          )}
        </div>

        {/* Content — scrolls within the panel */}
        <div
          className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6"
          style={{
            // Leave room at the bottom for the mobile action bar.
            paddingBottom:
              actions != null
                ? "calc(80px + var(--safe-bottom))"
                : "calc(16px + var(--safe-bottom))",
          }}
        >
          {children}
        </div>

        {/* Mobile sticky action bar — only when actions are provided.
            Hidden on md+ where actions live in the header. */}
        {actions && (
          <div
            className="md:hidden mobile-action-bar"
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>

      <style>{`
        /* Mobile (below md): sheet slides up from bottom */
        @keyframes sheetUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        /* Desktop (md+): sheet slides in from the trailing edge.
           We override the panel positioning and animation. */
        @media (min-width: 768px) {
          [role="dialog"] {
            inset-inline-start: auto !important;
            top: 0 !important;
            bottom: 0 !important;
            inset-inline-end: 0 !important;
            inset-block: 0;
            width: min(640px, 100vw);
            border-inline-start: 1px solid var(--border);
            animation: slideInEnd 0.25s cubic-bezier(0.32, 0.72, 0, 1) !important;
          }
          @keyframes slideInEnd {
            from { transform: translateX(20%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        }
        /* RTL: slide-in direction reverses */
        html.rtl [role="dialog"] {
          animation-name: sheetUp;
        }
        @media (min-width: 768px) {
          html.rtl [role="dialog"] {
            animation-name: slideInStart !important;
          }
          @keyframes slideInStart {
            from { transform: translateX(-20%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        }
      `}</style>
    </>
  );
}

// Reusable detail section
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-3)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// Reusable key-value row
export function DetailRow({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  badge?: { color: string; bg: string };
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      {badge ? (
        <span className="badge" style={{ background: badge.bg, color: badge.color }}>
          {value}
        </span>
      ) : (
        <span
          className={`text-sm text-end min-w-0 ${mono ? "font-mono" : ""}`}
          style={{ color: "var(--text-1)", wordBreak: "break-word" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
