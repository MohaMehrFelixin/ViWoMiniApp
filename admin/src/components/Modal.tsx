import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky bottom action bar — buttons rendered here stay reachable above
   *  the keyboard on mobile. */
  footer?: ReactNode;
  /** Max width on tablet+ screens. Defaults to 480px. */
  maxWidth?: number;
}

// Modal — adapts between a centered desktop modal and a mobile bottom sheet.
// Use this for forms (create/edit). For confirmation/prompt dialogs, use the
// `confirmDialog`/`promptDialog` API in Dialog.tsx instead.
//
// Mobile (default): bottom sheet that covers up to 92dvh, top-rounded, with
// a sticky footer for the primary actions and a sticky header with X button.
//
// Tablet+ (sm: 640px): centered card with the supplied max-width.

export function Modal({ open, onClose, title, children, footer, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "fadeIn 0.18s ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-card"
        style={{
          position: "fixed",
          zIndex: 9999,
          background: "var(--bg-elev-2)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92dvh",
          ["--modal-max-w" as string]: `${maxWidth}px`,
          animation: "modalIn 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Header — sticky to top */}
        <div
          className="flex items-center gap-3 border-b px-4 md:px-5 py-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-elev-2)",
            position: "sticky",
            top: 0,
            zIndex: 2,
            minHeight: 56,
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
          }}
        >
          <h2 className="text-base md:text-lg font-bold flex-1 truncate" style={{ color: "var(--text-1)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body — scrolls within the modal */}
        <div
          className="px-4 md:px-5 py-4 md:py-5 overflow-y-auto flex-1"
          style={{ minHeight: 0 }}
        >
          {children}
        </div>

        {/* Sticky footer — only when supplied */}
        {footer && (
          <div
            className="flex gap-2 border-t px-4 md:px-5 py-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-elev-2)",
              position: "sticky",
              bottom: 0,
              paddingBottom: "calc(12px + var(--safe-bottom))",
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        /* Mobile (default): full-width bottom sheet */
        .modal-card {
          inset-inline: 0;
          bottom: 0;
          width: 100%;
          border-radius: 20px 20px 0 0;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Tablet+ (sm 640px): centered card */
        @media (min-width: 640px) {
          .modal-card {
            inset: auto;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(var(--modal-max-w), calc(100vw - 32px));
            border-radius: 16px;
          }
          @keyframes modalIn {
            from { opacity: 0; transform: translate(-50%, -48%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        }
      `}</style>
    </>
  );
}
