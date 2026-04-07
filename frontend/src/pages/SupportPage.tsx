import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconWarning, IconCheck } from "../components/Icons";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";
import { formatDate } from "../lib/utils";
import { getTickets, submitTicket } from "../api/coupon";
import { extractErrorMessage } from "../lib/api-error";
import type { SupportTicket } from "../lib/types";

// ─── Ticket Categories ──────────────────────────────

interface TicketCategory {
  key: string;
  icon: string;
  color: string;
  priority: "normal" | "high" | "urgent";
}

const TICKET_CATEGORIES: TicketCategory[] = [
  { key: "coupon_issue",      icon: "🎫", color: "var(--cat-water)",   priority: "high" },
  { key: "account_issue",     icon: "👤", color: "var(--cat-fuel)",    priority: "normal" },
  { key: "app_bug",           icon: "🐛", color: "var(--cat-hygiene)", priority: "normal" },
  { key: "data_correction",   icon: "📝", color: "var(--cat-food)",    priority: "normal" },
  { key: "corruption_report", icon: "🚨", color: "var(--cat-medical)", priority: "urgent" },
  { key: "critical_report",   icon: "⚠️", color: "var(--cat-energy)",  priority: "urgent" },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  open:        { color: "var(--cat-water)",   bg: "rgba(59,130,246,0.12)" },
  in_progress: { color: "var(--cat-fuel)",    bg: "rgba(249,115,22,0.12)" },
  resolved:    { color: "var(--cat-food)",    bg: "rgba(34,197,94,0.12)" },
  closed:      { color: "var(--text-3)",      bg: "var(--separator)" },
};

// ─── Back Button ──────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const tgBack = window.Telegram?.WebApp?.BackButton;
    if (tgBack) {
      tgBack.show();
      tgBack.onClick(onClick);
      return () => { tgBack.offClick(onClick); tgBack.hide(); };
    }
  }, [onClick]);
  return (
    <button onClick={onClick} className="text-secondary flex items-center gap-1 text-sm" aria-label={t("common.back")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {t("common.back")}
    </button>
  );
}

// ─── Ticket List Item ──────────────────────────────

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const { t, i18n } = useTranslation();
  const cat = TICKET_CATEGORIES.find((c) => c.key === ticket.category);
  const statusStyle = STATUS_STYLES[ticket.status] || { color: "var(--cat-water)", bg: "rgba(59,130,246,0.12)" };

  return (
    <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: "0.5px solid var(--separator)" }}>
      <span className="mt-0.5 text-lg">{cat?.icon ?? "📋"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-primary text-sm font-medium leading-snug">
          {ticket.subject}
        </p>
        <p className="text-tertiary mt-0.5 truncate text-xs">
          {t(`support.cat_${ticket.category}`)} · {formatDate(ticket.created_at, i18n.language)}
        </p>
      </div>
      <span
        className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: statusStyle.bg, color: statusStyle.color }}
      >
        {t(`support.status_${ticket.status}`)}
      </span>
    </div>
  );
}

// ─── New Ticket Form ────────────────────────────────

type FormStep = "category" | "details" | "submitting" | "done";

function NewTicketForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === "fa";
  const [step, setStep] = useState<FormStep>("category");
  const [selectedCat, setSelectedCat] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const canSubmit = selectedCat && subject.trim().length >= 3 && description.trim().length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setStep("submitting");
    setError(null);
    try {
      await submitTicket({
        category: selectedCat.key,
        priority: selectedCat.priority,
        subject: subject.trim(),
        description: description.trim(),
        reference_code: reference.trim() || undefined,
      });
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      setStep("done");
    } catch (err) {
      const msg = await extractErrorMessage(err, t("common.error"));
      setError(msg);
      setStep("details");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      submittingRef.current = false;
    }
  };

  // ── Success ──
  if (step === "done") {
    return (
      <div className="glass glass-prominent glass-animate flex flex-col items-center gap-5 p-8 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "rgba(34,197,94,0.15)", boxShadow: "0 0 40px rgba(34,197,94,0.2)" }}
        >
          <IconCheck size={40} color="rgb(34,197,94)" />
        </div>
        <div>
          <h2 className="text-primary text-xl font-bold">{t("support.submitted")}</h2>
          <p className="text-secondary mt-2 text-sm">{t("support.submittedDesc")}</p>
        </div>
        <button className="glass-btn glass-btn-primary glass-btn-lg w-full" onClick={onDone}>
          {t("support.backToTickets")}
        </button>
      </div>
    );
  }

  // ── Submitting ──
  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-white/20" style={{ borderTopColor: "var(--accent)" }} />
        <p className="text-secondary mt-4 text-sm">{t("support.sending")}</p>
        <button
          className="glass-btn glass-btn-sm mt-4"
          onClick={() => {
            submittingRef.current = false;
            setError(t("common.cancel"));
            setStep("details");
          }}
        >
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  // ── Category Selection ──
  if (step === "category") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-primary text-lg font-bold">{t("support.whatIssue")}</h2>
          <p className="text-secondary mt-1 text-xs">{t("support.pickCategory")}</p>
        </div>

        <div className="space-y-2">
          {TICKET_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCat(cat);
                setStep("details");
                window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
              }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-start active:scale-[0.98] transition-transform"
              style={{ background: "var(--separator)" }}
              aria-label={t(`support.cat_${cat.key}`)}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)` }}
              >
                {cat.icon}
              </div>
              <div className="flex-1">
                <p className="text-primary text-sm font-semibold">{t(`support.cat_${cat.key}`)}</p>
                <p className="text-tertiary mt-0.5 text-[11px] leading-snug">{t(`support.catDesc_${cat.key}`)}</p>
              </div>
              {cat.priority === "urgent" && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "rgba(239,68,68,0.12)", color: "var(--cat-medical)" }}
                >
                  {t("support.urgent")}
                </span>
              )}
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isFa ? "scaleX(-1)" : undefined }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        <button className="glass-btn w-full" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  // ── Details Form ──
  return (
    <div className="space-y-4">
      {/* Selected category badge */}
      <button
        onClick={() => setStep("category")}
        className="flex items-center gap-2 rounded-xl px-3 py-2 active:opacity-70"
        style={{ background: `color-mix(in srgb, ${selectedCat?.color ?? "var(--accent)"} 12%, transparent)` }}
        aria-label={t("support.changeCategory")}
      >
        <span className="text-sm">{selectedCat?.icon}</span>
        <span className="text-sm font-medium" style={{ color: selectedCat?.color }}>{t(`support.cat_${selectedCat?.key}`)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={selectedCat?.color ?? "var(--accent)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Urgent warning */}
      {selectedCat?.priority === "urgent" && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
          <IconWarning size={16} color="var(--cat-medical)" />
          <p className="text-xs" style={{ color: "var(--cat-medical)" }}>{t("support.urgentNote")}</p>
        </div>
      )}

      {/* Subject */}
      <div>
        <label className="text-secondary mb-1.5 block text-xs font-medium">{t("support.subject")}</label>
        <input
          className="glass-input"
          placeholder={t("support.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          autoFocus
          aria-label={t("support.subject")}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-secondary mb-1.5 block text-xs font-medium">{t("support.description")}</label>
        <textarea
          className="glass-input min-h-[120px] resize-none"
          placeholder={t("support.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          aria-label={t("support.description")}
        />
        {description.length > 0 && (
          <p className="text-tertiary mt-1 text-end text-[10px]">{description.length}/2000</p>
        )}
      </div>

      {/* Reference code (optional) */}
      <div>
        <label className="text-secondary mb-1.5 block text-xs font-medium">
          {t("support.reference")} <span className="text-tertiary">({t("support.optional")})</span>
        </label>
        <input
          className="glass-input font-mono"
          placeholder={t("support.referencePlaceholder")}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={100}
          dir="ltr"
          aria-label={t("support.reference")}
        />
      </div>

      {error && (
        <div className="rounded-xl p-3 text-center text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "var(--cat-medical)" }}>
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={() => setStep("category")}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {t("support.submit")}
        </button>
      </div>
    </div>
  );
}

// ─── Main Support Page ──────────────────────────────

export function SupportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isFa = i18n.language === "fa";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTickets();
      setTickets(res.tickets ?? []);
    } catch {
      if (import.meta.env.DEV) {
        setTickets([
          { id: 1, category: "coupon_issue", priority: "high", subject: "Missing water allocation", description: "", reference_code: "VC-123", status: "in_progress", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString() },
          { id: 2, category: "app_bug", priority: "normal", subject: "Scanner not opening", description: "", status: "resolved", created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date().toISOString() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleBackFromCreate = useCallback(() => setCreating(false), []);
  const handleTicketDone = useCallback(() => {
    setCreating(false);
    fetchTickets();
  }, [fetchTickets]);
  const handleBackToProfile = useCallback(() => navigate("/profile"), [navigate]);

  // Creating a new ticket
  if (creating) {
    return (
      <div className="space-y-4 p-4">
        <BackButton onClick={handleBackFromCreate} />
        <NewTicketForm
          onDone={handleTicketDone}
          onCancel={handleBackFromCreate}
        />
      </div>
    );
  }

  // Ticket list
  const active = tickets.filter((tk) => tk.status === "open" || tk.status === "in_progress");
  const past = tickets.filter((tk) => tk.status === "resolved" || tk.status === "closed");

  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={handleBackToProfile} />
      <h1 className="text-primary text-xl font-bold">{t("support.title")}</h1>

      {/* New Ticket Button */}
      <button
        className="glass glass-interactive glass-animate flex w-full items-center gap-4 p-4 text-start"
        onClick={() => {
          setCreating(true);
          window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
        }}
        aria-label={t("support.newTicket")}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg"
          style={{ background: "rgba(59,130,246,0.12)" }}
        >
          +
        </div>
        <div className="flex-1">
          <p className="text-primary text-sm font-semibold">{t("support.newTicket")}</p>
          <p className="text-tertiary text-[11px]">{t("support.newTicketDesc")}</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isFa ? "scaleX(-1)" : undefined }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {loading ? (
        <Loading />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl opacity-40">📋</span>}
          title={t("support.noTickets")}
        />
      ) : (
        <>
          {/* Active tickets */}
          {active.length > 0 && (
            <div className="glass glass-animate overflow-hidden" style={{ animationDelay: "50ms" }}>
              <div className="px-4 pt-3 pb-1">
                <p className="text-secondary text-xs font-semibold">{t("support.active")}</p>
              </div>
              {active.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}

          {/* Past tickets */}
          {past.length > 0 && (
            <div className="glass glass-animate overflow-hidden" style={{ animationDelay: "100ms" }}>
              <div className="px-4 pt-3 pb-1">
                <p className="text-secondary text-xs font-semibold">{t("support.past")}</p>
              </div>
              {past.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
