import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { api } from "../api/client";

interface VolunteerRow {
  id: number;
  full_name: string;
  specialty: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = { approved: "#22c55e", pending: "#f59e0b", rejected: "#ef4444", suspended: "#6b7280" };

export function VolunteersPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await api.get("volunteers", { searchParams: { page, limit: 25 } }).json<{
      volunteers: VolunteerRow[];
      total: number;
    }>();
    return { items: res.volunteers ?? [], total: res.total };
  }, []);

  return (
    <PageShell<VolunteerRow>
      title="Volunteers"
      subtitle="Manage volunteer applications"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "full_name", label: "Name", render: (r) => <span className="font-medium">{r.full_name}</span> },
        { key: "specialty", label: "Specialty", render: (r) => <span className="text-xs capitalize">{(r.specialty || "General").replace(/_/g, " ")}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status}</span> },
        { key: "created_at", label: "Applied", render: (r) => new Date(r.created_at).toLocaleDateString() },
      ]}
    />
  );
}
