import { useCallback, useState } from "react";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listHouseholds, getHousehold, suspendHousehold, reactivateHousehold } from "../api/admin";
import { Loader2, Ban, CheckCircle } from "lucide-react";

interface HouseholdRow {
  id: number;
  household_code: string;
  status: string;
  kyc_tier: number;
  location_segment: string;
  address: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--success)", bg: "rgba(34,197,94,0.15)" },
  suspended: { color: "var(--danger)", bg: "rgba(239,68,68,0.15)" },
  pending: { color: "var(--warning)", bg: "rgba(249,115,22,0.15)" },
};

export function HouseholdsPage() {
  const [selected, setSelected] = useState<HouseholdRow | null>(null);
  const [detail, setDetail] = useState<{ household: any; members: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async (page: number) => {
    const res = await listHouseholds({ page: String(page), limit: "25" });
    return { items: (res.households ?? []) as HouseholdRow[], total: res.total };
  }, [refreshKey]); // eslint-disable-line

  const openDetail = async (row: HouseholdRow) => {
    setSelected(row);
    setDetailLoading(true);
    try {
      const res = await getHousehold(row.id);
      setDetail(res);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };

  const handleSuspend = async () => {
    if (!selected) return;
    const reason = prompt("Suspension reason:");
    if (!reason) return;
    setActing(true);
    try {
      await suspendHousehold(selected.id, reason);
      setSelected({ ...selected, status: "suspended" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const handleReactivate = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await reactivateHousehold(selected.id);
      setSelected({ ...selected, status: "active" });
      setRefreshKey((k) => k + 1);
    } catch { /* */ }
    setActing(false);
  };

  const st = STATUS_COLORS[selected?.status ?? ""] ?? STATUS_COLORS.pending;

  return (
    <>
      <PageShell<HouseholdRow>
        title="Households"
        subtitle="Manage registered households"
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={openDetail}
        columns={[
          { key: "household_code", label: "Code", render: (r) => <span className="font-mono text-xs font-semibold">{r.household_code}</span> },
          { key: "status", label: "Status", render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending; return <span className="badge" style={{ background: s.bg, color: s.color }}>{r.status}</span>; } },
          { key: "kyc_tier", label: "KYC Tier", render: (r) => <span>Tier {r.kyc_tier}</span> },
          { key: "location_segment", label: "Region" },
          { key: "address", label: "Address", render: (r) => <span className="truncate max-w-[200px] block text-xs">{r.address}</span> },
          { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => { setSelected(null); setDetail(null); }}
        title={selected?.household_code ?? ""}
        subtitle={`Household #${selected?.id}`}
        actions={
          selected && (
            <>
              {selected.status === "active" ? (
                <button className="btn btn-danger" onClick={handleSuspend} disabled={acting}>
                  <Ban size={14} /> Suspend
                </button>
              ) : selected.status === "suspended" ? (
                <button className="btn btn-primary" onClick={handleReactivate} disabled={acting}>
                  <CheckCircle size={14} /> Reactivate
                </button>
              ) : null}
            </>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>
        ) : detail ? (
          <>
            <DetailSection title="Household Info">
              <DetailRow label="Code" value={detail.household.household_code} mono />
              <DetailRow label="Status" value={selected?.status ?? ""} badge={st} />
              <DetailRow label="KYC Tier" value={`Tier ${detail.household.kyc_tier}`} />
              <DetailRow label="Region" value={detail.household.location_segment} />
              <DetailRow label="Address" value={detail.household.address} />
              <DetailRow label="Telegram ID" value={detail.household.telegram_user_id} mono />
              <DetailRow label="Created" value={new Date(detail.household.created_at).toLocaleString()} />
            </DetailSection>

            <DetailSection title={`Members (${detail.members?.length ?? 0})`}>
              {detail.members?.length > 0 ? (
                <div className="space-y-2">
                  {detail.members.map((m: any) => (
                    <div key={m.id} className="card p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{m.full_name}</p>
                          <p className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>{m.national_code} · {m.relationship} · {m.gender}</p>
                        </div>
                        <span className="badge" style={{
                          background: m.kyc_verified ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                          color: m.kyc_verified ? "var(--success)" : "var(--warning)",
                        }}>
                          {m.kyc_verified ? "KYC ✓" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-3)" }}>No members</p>
              )}
            </DetailSection>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-3)" }}>Failed to load details</p>
        )}
      </DetailPanel>
    </>
  );
}
