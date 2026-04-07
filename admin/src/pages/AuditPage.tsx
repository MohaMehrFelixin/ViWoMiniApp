import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listAuditLogs } from "../api/admin";
import type { AuditLog } from "../lib/types";

const ACTION_COLORS: Record<string, string> = {
  login: "#3b82f6", logout: "#6b7280", create: "#22c55e", update: "#f59e0b",
  delete: "#ef4444", approve: "#22c55e", reject: "#ef4444", export: "#a855f7",
  suspend: "#ef4444", reactivate: "#22c55e", accept_dispute: "#22c55e",
  reject_dispute: "#f59e0b", resolve: "#22c55e",
};

export function AuditPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listAuditLogs({ page: String(page), limit: "25" });
    return { items: res.logs ?? [], total: res.total };
  }, []);

  return (
    <PageShell<AuditLog>
      title="Audit Trail"
      subtitle="Immutable log of all admin actions"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "created_at", label: "Time", render: (r) => <span className="text-xs font-mono">{new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> },
        { key: "admin_id", label: "Admin ID", render: (r) => <span className="font-mono text-xs">#{r.admin_id}</span> },
        { key: "action", label: "Action", render: (r) => <span className="badge" style={{ background: `${ACTION_COLORS[r.action] ?? "#666"}18`, color: ACTION_COLORS[r.action] ?? "#666" }}>{r.action}</span> },
        { key: "entity_type", label: "Entity", render: (r) => <span className="text-xs capitalize">{r.entity_type.replace(/_/g, " ")}</span> },
        { key: "entity_id", label: "Entity ID", render: (r) => r.entity_id ? <span className="font-mono text-xs">#{r.entity_id}</span> : <span style={{ color: "var(--text-3)" }}>—</span> },
        { key: "ip_address", label: "IP", render: (r) => <span className="font-mono text-xs" style={{ color: "var(--text-3)" }}>{r.ip_address}</span> },
      ]}
    />
  );
}
