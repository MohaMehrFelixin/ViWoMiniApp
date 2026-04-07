import { useCallback, useState } from "react";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listRedemptions, resolveDispute } from "../api/admin";
import { CheckCircle, XCircle } from "lucide-react";

interface RedemptionRow {
  id: number;
  household_id: number;
  category: string;
  amount: string;
  coupon_code: string;
  distribution_point_id: number;
  status: string;
  created_at: string;
}

const CAT_COLORS: Record<string, string> = {
  water: "#3b82f6", food: "#22c55e", fuel: "#f97316", hygiene: "#a855f7", medical: "#ef4444", energy: "#eab308",
};
const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  completed: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  disputed: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  reversed: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  pending: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
};

export function RedemptionsPage() {
  const [selected, setSelected] = useState<RedemptionRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async (page: number) => {
    const res = await listRedemptions({ page: String(page), limit: "25" });
    return { items: (res.redemptions ?? []) as RedemptionRow[], total: res.total };
  }, [refreshKey]); // eslint-disable-line

  const handleResolve = async (accepted: boolean) => {
    if (!selected) return;
    const resolution = prompt(accepted ? "Reversal reason:" : "Rejection reason:");
    if (!resolution) return;
    setActing(true);
    try {
      await resolveDispute(selected.id, accepted, resolution);
      setSelected({ ...selected, status: accepted ? "reversed" : "completed" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const ss = STATUS_COLORS[selected?.status ?? "completed"] ?? STATUS_COLORS.completed;

  return (
    <>
      <PageShell<RedemptionRow>
        title="Redemptions"
        subtitle="Track coupon redemptions and resolve disputes"
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "coupon_code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.coupon_code}</span> },
          { key: "household_id", label: "Household", render: (r) => <span className="font-mono text-xs">#{r.household_id}</span> },
          { key: "category", label: "Category", render: (r) => <span className="badge" style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}>{r.category}</span> },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status", render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.completed; return <span className="badge" style={{ background: s.bg, color: s.color }}>{r.status}</span>; } },
          { key: "created_at", label: "Time", render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.coupon_code ?? ""}
        subtitle={`Redemption #${selected?.id}`}
        actions={
          selected?.status === "disputed" ? (
            <>
              <button className="btn btn-primary" onClick={() => handleResolve(true)} disabled={acting}>
                <CheckCircle size={14} /> Accept (Reverse)
              </button>
              <button className="btn btn-danger" onClick={() => handleResolve(false)} disabled={acting}>
                <XCircle size={14} /> Reject Dispute
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <DetailSection title="Redemption Details">
            <DetailRow label="Coupon Code" value={selected.coupon_code} mono />
            <DetailRow label="Category" value={selected.category} badge={{ color: CAT_COLORS[selected.category] ?? "#666", bg: `${CAT_COLORS[selected.category] ?? "#666"}18` }} />
            <DetailRow label="Amount" value={selected.amount} />
            <DetailRow label="Status" value={selected.status} badge={ss} />
            <DetailRow label="Household" value={`#${selected.household_id}`} mono />
            <DetailRow label="Center" value={`#${selected.distribution_point_id}`} mono />
            <DetailRow label="Created" value={new Date(selected.created_at).toLocaleString()} />
          </DetailSection>
        )}
      </DetailPanel>
    </>
  );
}
