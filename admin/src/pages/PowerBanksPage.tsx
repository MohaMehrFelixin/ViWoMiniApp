import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { api } from "../api/client";

interface SwapRow { id: number; household_id: number; status: string; swap_code: string; created_at: string; updated_at: string; }
const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", ready: "#3b82f6", picked_up: "#22c55e", returned: "#6b7280", cancelled: "#ef4444" };

export function PowerBanksPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await api.get("powerbanks", { searchParams: { page, limit: 25 } }).json<{ swaps: SwapRow[]; total: number }>();
    return { items: res.swaps ?? [], total: res.total };
  }, []);

  return (
    <PageShell<SwapRow>
      title="Power Bank Swaps"
      subtitle="Track power bank swap lifecycle"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "swap_code", label: "Code", render: (r) => <span className="font-mono text-xs font-semibold">{r.swap_code}</span> },
        { key: "household_id", label: "Household", render: (r) => <span className="font-mono text-xs">#{r.household_id}</span> },
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status.replace(/_/g, " ")}</span> },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
        { key: "updated_at", label: "Updated", render: (r) => new Date(r.updated_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
      ]}
    />
  );
}
