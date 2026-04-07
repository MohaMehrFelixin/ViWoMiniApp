import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listProviders } from "../api/admin";

interface ProviderRow {
  id: number;
  name: string;
  type: string;
  service_type: string;
  status: string;
  store_address: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = { approved: "#22c55e", pending: "#f59e0b", rejected: "#ef4444", suspended: "#6b7280" };

export function ProvidersPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listProviders({ page: String(page), limit: "25" });
    return { items: (res.providers ?? []) as ProviderRow[], total: res.total };
  }, []);

  return (
    <PageShell<ProviderRow>
      title="Providers"
      subtitle="Manage distributors and service providers"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "type", label: "Type", render: (r) => <span className="text-xs capitalize">{String(r.type).replace(/_/g, " ")}</span> },
        { key: "service_type", label: "Service", render: (r) => <span className="text-xs capitalize">{String(r.service_type).replace(/_/g, " ")}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status}</span> },
        { key: "store_address", label: "Address", render: (r) => <span className="max-w-[200px] truncate block text-xs">{r.store_address}</span> },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
      ]}
    />
  );
}
