import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listHouseholds } from "../api/admin";

interface HouseholdRow {
  id: number;
  household_code: string;
  status: string;
  kyc_tier: number;
  location_segment: string;
  address: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--success)", suspended: "var(--danger)", pending: "var(--warning)",
};

export function HouseholdsPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listHouseholds({ page: String(page), limit: "25" });
    return { items: (res.households ?? []) as HouseholdRow[], total: res.total };
  }, []);

  return (
    <PageShell<HouseholdRow>
      title="Households"
      subtitle="Manage registered households"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "household_code", label: "Code", render: (r) => <span className="font-mono text-xs font-semibold">{r.household_code}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "var(--text-3)"}18`, color: STATUS_COLORS[r.status] }}>{r.status}</span> },
        { key: "kyc_tier", label: "KYC Tier", render: (r) => <span>Tier {r.kyc_tier}</span> },
        { key: "location_segment", label: "Region" },
        { key: "address", label: "Address", render: (r) => <span className="truncate max-w-[200px] block text-xs">{r.address}</span> },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
      ]}
    />
  );
}
