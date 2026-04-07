import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listTickets } from "../api/admin";

interface TicketRow {
  id: number;
  category: string;
  priority: string;
  subject: string;
  status: string;
  created_at: string;
}

const PRIO_COLORS: Record<string, string> = { urgent: "#ef4444", high: "#f97316", normal: "#3b82f6" };
const STATUS_COLORS: Record<string, string> = { open: "#3b82f6", in_progress: "#f59e0b", resolved: "#22c55e", closed: "#6b7280" };

export function TicketsPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listTickets({ page: String(page), limit: "25" });
    return { items: (res.tickets ?? []) as TicketRow[], total: res.total };
  }, []);

  return (
    <PageShell<TicketRow>
      title="Support Tickets"
      subtitle="Review and resolve user issues"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "id", label: "#", render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
        { key: "priority", label: "Priority", render: (r) => <span className="badge" style={{ background: `${PRIO_COLORS[r.priority] ?? "#666"}18`, color: PRIO_COLORS[r.priority] }}>{r.priority}</span> },
        { key: "category", label: "Category", render: (r) => <span className="text-xs capitalize">{r.category.replace(/_/g, " ")}</span> },
        { key: "subject", label: "Subject", render: (r) => <span className="max-w-[300px] truncate block">{r.subject}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status.replace(/_/g, " ")}</span> },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ]}
    />
  );
}
