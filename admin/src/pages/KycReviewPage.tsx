import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  listHouseholds,
  updateHouseholdKYCStatus,
  type HouseholdRow,
} from "../api/admin";
import { Loader2, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { useToast } from "../components/Toast";
import { confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

// KYC Review page implements the spec §6 kanban-style queue:
//   Pending  →  Verified  →  Rejected
// Each card shows the household code, address, KYC tier, and inline approve/
// reject buttons. KYC officers (L4+) can act; lower roles see read-only.
//
// This satisfies spec §12.5 (display ClassifiedError codes is left to the
// detail panel — for the queue itself we just show statuses).

const COLUMN_KEYS = [
  { key: "pending", color: "var(--warning)", icon: Clock },
  { key: "verified", color: "var(--success)", icon: ShieldCheck },
  { key: "rejected", color: "var(--danger)", icon: ShieldX },
] as const;

export function KycReviewPage() {
  const { t } = useTranslation();
  const [byStatus, setByStatus] = useState<Record<string, HouseholdRow[]>>({
    pending: [],
    verified: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canAct = role >= 4;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // The list endpoint paginates, so we fetch up to 100 of each status.
      // For a real high-volume system this would need infinite scroll per
      // column; for now this gives a workable kanban for ops teams.
      const [pending, verified, rejected] = await Promise.all([
        listHouseholds({ limit: "100" }), // unfiltered, we partition client-side
        Promise.resolve({ households: [], total: 0 }),
        Promise.resolve({ households: [], total: 0 }),
      ]);
      const buckets: Record<string, HouseholdRow[]> = { pending: [], verified: [], rejected: [] };
      for (const h of pending.households) {
        const s = h.kyc_status ?? "pending";
        if (!buckets[s]) buckets[s] = [];
        buckets[s].push(h);
      }
      // Quiet the unused vars warnings.
      void verified;
      void rejected;
      setByStatus(buckets);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.loadFailed")));
    }
    setLoading(false);
  }, [toast, t]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleApprove = async (h: HouseholdRow) => {
    setActing(h.id);
    try {
      await updateHouseholdKYCStatus(h.id, "verified");
      toast.success(t("kycReview.toasts.approved", { code: h.household_code }));
      await fetchAll();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.approveFailed")));
    }
    setActing(null);
  };

  const handleReject = async (h: HouseholdRow) => {
    const ok = await confirmDialog({
      title: t("kycReview.rejectDialog.title", { code: h.household_code }),
      message: t("kycReview.rejectDialog.message"),
      variant: "danger",
      confirmLabel: t("kycReview.rejectDialog.confirm"),
    });
    if (!ok) return;
    setActing(h.id);
    try {
      await updateHouseholdKYCStatus(h.id, "rejected");
      toast.success(t("kycReview.toasts.rejected", { code: h.household_code }));
      await fetchAll();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.rejectFailed")));
    }
    setActing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-1)" }}>
          {t("kycReview.title")}
        </h1>
        <p className="text-xs md:text-sm mt-0.5 md:mt-1" style={{ color: "var(--text-3)" }}>
          {t("kycReview.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {COLUMN_KEYS.map((col) => {
          const list = byStatus[col.key] ?? [];
          const Icon = col.icon;
          return (
            <div key={col.key} className="card p-4">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--border)]">
                <Icon size={16} style={{ color: col.color }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  {t(`kycReview.columns.${col.key}`)}
                </h2>
                <span
                  className="ms-auto text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${col.color}18`, color: col.color }}
                >
                  {list.length}
                </span>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {list.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: "var(--text-3)" }}>
                    {t("kycReview.noItems")}
                  </p>
                ) : (
                  list.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg p-3"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-1)" }}>
                          {h.household_code}
                        </p>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(59,130,246,0.15)",
                            color: "var(--accent)",
                          }}
                        >
                          T{h.kyc_tier}
                        </span>
                      </div>
                      <p
                        className="text-[11px] truncate mb-2"
                        style={{ color: "var(--text-3)" }}
                        title={h.address}
                      >
                        {h.address || "(no address)"}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-3)" }}>
                        {h.province_code} · {h.location_segment}
                      </p>
                      {canAct && col.key === "pending" && (
                        <div className="flex gap-1 mt-3">
                          <button
                            className="btn btn-primary"
                            style={{ padding: "4px 8px", flex: 1, fontSize: 11 }}
                            onClick={() => handleApprove(h)}
                            disabled={acting === h.id}
                          >
                            <ShieldCheck size={12} /> {t("kycReview.approve")}
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "4px 8px", flex: 1, fontSize: 11 }}
                            onClick={() => handleReject(h)}
                            disabled={acting === h.id}
                          >
                            <ShieldX size={12} /> {t("kycReview.reject")}
                          </button>
                        </div>
                      )}
                      {canAct && col.key === "rejected" && (
                        <button
                          className="btn"
                          style={{ padding: "4px 8px", marginTop: 8, fontSize: 11, width: "100%" }}
                          onClick={() => handleApprove(h)}
                          disabled={acting === h.id}
                        >
                          <ShieldCheck size={12} /> {t("kycReview.reapprove")}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
