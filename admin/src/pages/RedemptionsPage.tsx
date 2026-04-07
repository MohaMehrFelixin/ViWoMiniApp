import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listRedemptions } from "../api/admin";

interface RedemptionRow {
  id: number;
  household_id: number;
  category: string;
  amount: string;
  coupon_code: string;
  status: string;
  created_at: string;
}

const CAT_COLORS: Record<string, string> = {
  water: "#3b82f6", food: "#22c55e", fuel: "#f97316", hygiene: "#a855f7", medical: "#ef4444", energy: "#eab308",
};

export function RedemptionsPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listRedemptions({ page: String(page), limit: "25" });
    return { items: (res.redemptions ?? []) as RedemptionRow[], total: res.total };
  }, []);

  return (
    <PageShell<RedemptionRow>
      title="Redemptions"
      subtitle="Track coupon redemptions"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "coupon_code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.coupon_code}</span> },
        { key: "household_id", label: "Household", render: (r) => <span className="font-mono text-xs">#{r.household_id}</span> },
        { key: "category", label: "Category", render: (r) => <span className="badge" style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}>{r.category}</span> },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status", render: (r) => {
          const c = r.status === "completed" ? "var(--success)" : r.status === "disputed" ? "var(--warning)" : "var(--danger)";
          return <span className="badge" style={{ background: `${c}18`, color: c }}>{r.status}</span>;
        }},
        { key: "created_at", label: "Time", render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ]}
    />
  );
}
