import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { api } from "../api/client";

interface AllocationRow { id: number; household_id: number; category: string; total_amount: string; used_amount: string; remaining_amount: string; current_week: number; status: string; created_at: string; }
const CAT_COLORS: Record<string, string> = { water: "#3b82f6", food: "#22c55e", fuel: "#f97316", hygiene: "#a855f7", medical: "#ef4444", energy: "#eab308" };
const STATUS_COLORS: Record<string, string> = { active: "#22c55e", expired: "#6b7280", exhausted: "#ef4444" };

export function AllocationsPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await api.get("allocations", { searchParams: { page, limit: 25 } }).json<{ allocations: AllocationRow[]; total: number }>();
    return { items: res.allocations ?? [], total: res.total };
  }, []);

  return (
    <PageShell<AllocationRow>
      title="Allocations"
      subtitle="Coupon allocations across all households"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "household_id", label: "Household", render: (r) => <span className="font-mono text-xs">#{r.household_id}</span> },
        { key: "category", label: "Category", render: (r) => <span className="badge" style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}>{r.category}</span> },
        { key: "total_amount", label: "Total", render: (r) => <span className="font-mono text-xs">{r.total_amount}</span> },
        { key: "used_amount", label: "Used", render: (r) => <span className="font-mono text-xs">{r.used_amount}</span> },
        { key: "remaining_amount", label: "Remaining", render: (r) => <span className="font-mono text-xs font-semibold">{r.remaining_amount}</span> },
        { key: "current_week", label: "Week", render: (r) => <span>W{r.current_week}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status}</span> },
      ]}
    />
  );
}
