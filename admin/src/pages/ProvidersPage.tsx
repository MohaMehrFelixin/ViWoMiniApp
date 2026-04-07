import { useCallback, useState } from "react";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listProviders, approveProvider, rejectProvider } from "../api/admin";
import { CheckCircle, XCircle } from "lucide-react";

interface ProviderRow {
  id: number;
  name: string;
  name_fa?: string;
  type: string;
  service_type: string;
  status: string;
  store_address: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  approved: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  suspended: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

export function ProvidersPage() {
  const [selected, setSelected] = useState<ProviderRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async (page: number) => {
    const res = await listProviders({ page: String(page), limit: "25" });
    return { items: (res.providers ?? []) as ProviderRow[], total: res.total };
  }, [refreshKey]); // eslint-disable-line

  const handleApprove = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await approveProvider(selected.id);
      setSelected({ ...selected, status: "approved" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const handleReject = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await rejectProvider(selected.id);
      setSelected({ ...selected, status: "rejected" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const ss = STATUS_COLORS[selected?.status ?? "pending"] ?? STATUS_COLORS.pending;

  return (
    <>
      <PageShell<ProviderRow>
        title="Providers"
        subtitle="Manage distributors and service providers"
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "type", label: "Type", render: (r) => <span className="text-xs capitalize">{String(r.type).replace(/_/g, " ")}</span> },
          { key: "service_type", label: "Service", render: (r) => <span className="text-xs capitalize">{String(r.service_type).replace(/_/g, " ")}</span> },
          { key: "status", label: "Status", render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending; return <span className="badge" style={{ background: s.bg, color: s.color }}>{r.status}</span>; } },
          { key: "store_address", label: "Address", render: (r) => <span className="max-w-[200px] truncate block text-xs">{r.store_address}</span> },
          { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={`Provider #${selected?.id}`}
        actions={
          selected?.status === "pending" ? (
            <>
              <button className="btn btn-primary" onClick={handleApprove} disabled={acting}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn btn-danger" onClick={handleReject} disabled={acting}>
                <XCircle size={14} /> Reject
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title="Provider Info">
              <DetailRow label="Name" value={selected.name} />
              {selected.name_fa && <DetailRow label="Name (FA)" value={selected.name_fa} />}
              <DetailRow label="Type" value={String(selected.type).replace(/_/g, " ")} />
              <DetailRow label="Service" value={String(selected.service_type).replace(/_/g, " ")} />
              <DetailRow label="Status" value={selected.status} badge={ss} />
              <DetailRow label="Address" value={selected.store_address} />
              <DetailRow label="Applied" value={new Date(selected.created_at).toLocaleString()} />
            </DetailSection>
          </>
        )}
      </DetailPanel>
    </>
  );
}
