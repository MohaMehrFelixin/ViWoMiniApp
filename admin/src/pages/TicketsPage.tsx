import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listTickets, resolveTicket, type TicketRow } from "../api/admin";
import { CheckCircle } from "lucide-react";
import { useToast } from "../components/Toast";
import { extractErrorMessage } from "../lib/errors";

const PRIO_COLORS: Record<string, { color: string; bg: string }> = {
  urgent: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  high: { color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  normal: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
};
const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  open: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  in_progress: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  resolved: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  closed: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

export function TicketsPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listTickets({ page: String(page), limit: "25" });
      return { items: res.tickets, total: res.total };
    },
    [refreshKey]
  );

  const handleResolve = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await resolveTicket(selected.id);
      toast.success(t("tickets.resolveSuccess"));
      setSelected({ ...selected, status: "resolved" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const ps = PRIO_COLORS[selected?.priority ?? "normal"] ?? PRIO_COLORS.normal;
  const ss = STATUS_COLORS[selected?.status ?? "open"] ?? STATUS_COLORS.open;

  return (
    <>
      <PageShell<TicketRow>
        title={t("tickets.title")}
        subtitle={t("tickets.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "id", label: "#", render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
          { key: "priority", label: t("tickets.priority"), render: (r) => { const p = PRIO_COLORS[r.priority] ?? PRIO_COLORS.normal; return <span className="badge" style={{ background: p.bg, color: p.color }}>{r.priority}</span>; } },
          { key: "category", label: t("tickets.category"), render: (r) => <span className="text-xs capitalize">{r.category.replace(/_/g, " ")}</span> },
          { key: "subject", label: t("tickets.subject"), render: (r) => <span className="max-w-[300px] truncate block">{r.subject}</span> },
          { key: "status", label: t("common.status"), render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.open; return <span className="badge" style={{ background: s.bg, color: s.color }}>{r.status.replace(/_/g, " ")}</span>; } },
          { key: "created_at", label: t("common.created"), render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`#${selected?.id ?? ""}`}
        subtitle={selected?.subject}
        actions={
          selected && (selected.status === "open" || selected.status === "in_progress") ? (
            <button className="btn btn-primary" onClick={handleResolve} disabled={acting}>
              <CheckCircle size={14} /> {t("common.confirm")}
            </button>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title={t("tickets.info")}>
              <DetailRow label={t("tickets.subject")} value={selected.subject} />
              <DetailRow label={t("tickets.category")} value={selected.category.replace(/_/g, " ")} />
              <DetailRow label={t("tickets.priority")} value={selected.priority} badge={ps} />
              <DetailRow label={t("common.status")} value={selected.status.replace(/_/g, " ")} badge={ss} />
              <DetailRow label={t("tickets.household")} value={`#${selected.household_id}`} mono />
              {selected.reference_code && <DetailRow label={t("tickets.reference")} value={selected.reference_code} mono />}
              <DetailRow label={t("common.created")} value={new Date(selected.created_at).toLocaleString()} />
            </DetailSection>

            <DetailSection title={t("tickets.description")}>
              <div className="card p-4">
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {selected.description || t("tickets.noDescription")}
                </p>
              </div>
            </DetailSection>
          </>
        )}
      </DetailPanel>
    </>
  );
}
