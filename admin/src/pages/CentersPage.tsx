import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listCenters } from "../api/admin";

interface CenterRow { id: number; name: string; type: string; address: string; status: string; operating_hours: string; province_code: string; }
const STATUS_COLORS: Record<string, string> = { open: "#22c55e", closed: "#ef4444", low_stock: "#f59e0b", out_of_stock: "#ef4444" };

export function CentersPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listCenters({ page: String(page), limit: "25" });
    return { items: (res.centers ?? []) as CenterRow[], total: res.total };
  }, []);

  return (
    <PageShell<CenterRow>
      title="Distribution Centers"
      subtitle="Manage distribution points"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "type", label: "Type", render: (r) => <span className="text-xs capitalize">{r.type}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status.replace(/_/g, " ")}</span> },
        { key: "operating_hours", label: "Hours" },
        { key: "address", label: "Address", render: (r) => <span className="max-w-[200px] truncate block text-xs">{r.address}</span> },
        { key: "province_code", label: "Province", render: (r) => <span className="font-mono text-xs">{r.province_code}</span> },
      ]}
    />
  );
}
