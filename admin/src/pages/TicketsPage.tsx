import { useCallback, useState } from "react";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listTickets, resolveTicket } from "../api/admin";
import { CheckCircle } from "lucide-react";

interface TicketRow {
  id: number;
  category: string;
  priority: string;
  subject: string;
  description: string;
  reference_code?: string;
  status: string;
  household_id: number;
  created_at: string;
}

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
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async (page: number) => {
    const res = await listTickets({ page: String(page), limit: "25" });
    return { items: (res.tickets ?? []) as TicketRow[], total: res.total };
  }, [refreshKey]); // eslint-disable-line

  const handleResolve = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await resolveTicket(selected.id);
      setSelected({ ...selected, status: "resolved" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const ps = PRIO_COLORS[selected?.priority ?? "normal"] ?? PRIO_COLORS.normal;
  const ss = STATUS_COLORS[selected?.status ?? "open"] ?? STATUS_COLORS.open;

  return (
    <>
      <PageShell<TicketRow>
        title="Support Tickets"
        subtitle="Review and resolve user issues"
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "id", label: "#", render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
          { key: "priority", label: "Priority", render: (r) => { const p = PRIO_COLORS[r.priority] ?? PRIO_COLORS.normal; return <span className="badge" style={{ background: p.bg, color: p.color }}>{r.priority}</span>; } },
          { key: "category", label: "Category", render: (r) => <span className="text-xs capitalize">{r.category.replace(/_/g, " ")}</span> },
          { key: "subject", label: "Subject", render: (r) => <span className="max-w-[300px] truncate block">{r.subject}</span> },
          { key: "status", label: "Status", render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.open; return <span className="badge" style={{ background: s.bg, color: s.color }}>{r.status.replace(/_/g, " ")}</span>; } },
          { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Ticket #${selected?.id}`}
        subtitle={selected?.subject}
        actions={
          selected && (selected.status === "open" || selected.status === "in_progress") ? (
            <button className="btn btn-primary" onClick={handleResolve} disabled={acting}>
              <CheckCircle size={14} /> Resolve
            </button>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title="Ticket Info">
              <DetailRow label="Subject" value={selected.subject} />
              <DetailRow label="Category" value={selected.category.replace(/_/g, " ")} />
              <DetailRow label="Priority" value={selected.priority} badge={ps} />
              <DetailRow label="Status" value={selected.status.replace(/_/g, " ")} badge={ss} />
              <DetailRow label="Household" value={`#${selected.household_id}`} mono />
              {selected.reference_code && <DetailRow label="Reference" value={selected.reference_code} mono />}
              <DetailRow label="Created" value={new Date(selected.created_at).toLocaleString()} />
            </DetailSection>

            <DetailSection title="Description">
              <div className="card p-4">
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {selected.description || "No description provided"}
                </p>
              </div>
            </DetailSection>
          </>
        )}
      </DetailPanel>
    </>
  );
}
