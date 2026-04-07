import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import {
  listHouseholds,
  getHousehold,
  suspendHousehold,
  reactivateHousehold,
  updateHouseholdNotes,
  updateHouseholdKYCStatus,
  type HouseholdRow,
  type MemberRow,
} from "../api/admin";
import { Loader2, Ban, CheckCircle, FileText, ShieldCheck, ShieldX } from "lucide-react";
import { useToast } from "../components/Toast";
import { promptDialog, confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--success)", bg: "rgba(34,197,94,0.15)" },
  suspended: { color: "var(--danger)", bg: "rgba(239,68,68,0.15)" },
  pending: { color: "var(--warning)", bg: "rgba(249,115,22,0.15)" },
};

const KYC_COLORS: Record<string, { color: string; bg: string }> = {
  verified: { color: "var(--success)", bg: "rgba(34,197,94,0.15)" },
  pending: { color: "var(--warning)", bg: "rgba(249,115,22,0.15)" },
  rejected: { color: "var(--danger)", bg: "rgba(239,68,68,0.15)" },
  expired: { color: "var(--text-3)", bg: "rgba(107,114,128,0.15)" },
};

export function HouseholdsPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<HouseholdRow | null>(null);
  const [detail, setDetail] = useState<{ household: HouseholdRow; members: MemberRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);

  // Wrapping fetchData with useCallback that depends on refreshKey is the
  // standard pattern for "trigger a refetch on demand".
  const fetchData = useCallback(
    async (page: number) => {
      const res = await listHouseholds({ page: String(page), limit: "25" });
      // Reference refreshKey so the dependency is real.
      void refreshKey;
      return { items: res.households, total: res.total };
    },
    [refreshKey]
  );

  const openDetail = async (row: HouseholdRow) => {
    setSelected(row);
    setDetailLoading(true);
    try {
      const res = await getHousehold(row.id);
      setDetail(res);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("households.toasts.loadFailed")));
      setDetail(null);
    }
    setDetailLoading(false);
  };

  const refresh = async () => {
    setRefreshKey((k) => k + 1);
    if (selected) {
      try {
        const res = await getHousehold(selected.id);
        setDetail(res);
        setSelected(res.household);
      } catch {
        // Silent — refresh is best-effort.
      }
    }
  };

  const handleSuspend = async () => {
    if (!selected) return;
    const reason = await promptDialog({
      title: t("households.dialogs.suspendTitle"),
      message: t("households.dialogs.suspendMessage"),
      placeholder: t("households.dialogs.suspendPlaceholder"),
      multiline: true,
      required: true,
      confirmLabel: t("households.dialogs.suspendConfirm"),
      variant: "danger",
    });
    if (!reason) return;
    setActing(true);
    try {
      await suspendHousehold(selected.id, reason);
      toast.success(t("households.toasts.suspended"));
      await refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleReactivate = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("households.dialogs.reactivateTitle"),
      message: t("households.dialogs.reactivateMessage"),
      confirmLabel: t("households.dialogs.reactivateConfirm"),
    });
    if (!ok) return;
    setActing(true);
    try {
      await reactivateHousehold(selected.id);
      toast.success(t("households.toasts.reactivated"));
      await refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleEditNotes = async () => {
    if (!selected) return;
    const notes = await promptDialog({
      title: t("households.dialogs.notesTitle"),
      message: t("households.dialogs.notesMessage"),
      defaultValue: detail?.household.admin_notes ?? "",
      multiline: true,
      placeholder: t("households.dialogs.notesPlaceholder"),
    });
    if (notes === null) return;
    try {
      await updateHouseholdNotes(selected.id, notes);
      toast.success(t("households.toasts.notesUpdated"));
      await refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.saveFailed")));
    }
  };

  const handleForceKYCReview = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("households.dialogs.forceKycTitle"),
      message: t("households.dialogs.forceKycMessage"),
      confirmLabel: t("households.dialogs.forceKycConfirm"),
      variant: "warning",
    });
    if (!ok) return;
    try {
      await updateHouseholdKYCStatus(selected.id, "rejected");
      toast.success(t("households.toasts.kycRejected"));
      await refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.updateFailed")));
    }
  };

  const handleApproveKYC = async () => {
    if (!selected) return;
    try {
      await updateHouseholdKYCStatus(selected.id, "verified");
      toast.success(t("households.toasts.kycApproved"));
      await refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.updateFailed")));
    }
  };

  const st = STATUS_COLORS[selected?.status ?? ""] ?? STATUS_COLORS.pending;
  const canManage = role >= 5; // Operations Manager and above

  return (
    <>
      <PageShell<HouseholdRow>
        title={t("households.title")}
        subtitle={t("households.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={openDetail}
        columns={[
          {
            key: "household_code",
            label: t("households.code"),
            render: (r) => <span className="font-mono text-xs font-semibold">{r.household_code}</span>,
          },
          {
            key: "status",
            label: t("common.status"),
            render: (r) => {
              const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
              return (
                <span className="badge" style={{ background: s.bg, color: s.color }}>
                  {t(`common.${r.status}`, r.status)}
                </span>
              );
            },
          },
          { key: "kyc_tier", label: t("households.kycTier"), render: (r) => <span>{t("households.tier", { n: r.kyc_tier })}</span> },
          {
            key: "kyc_status",
            label: t("households.kycStatus"),
            render: (r) => {
              const s = KYC_COLORS[r.kyc_status ?? "pending"] ?? KYC_COLORS.pending;
              return (
                <span className="badge" style={{ background: s.bg, color: s.color }}>
                  {t(`common.${r.kyc_status ?? "pending"}`, r.kyc_status ?? "pending")}
                </span>
              );
            },
          },
          { key: "location_segment", label: t("households.region") },
          { key: "province_code", label: t("households.province"), render: (r) => <span className="font-mono text-xs">{r.province_code}</span> },
          {
            key: "address",
            label: t("households.address"),
            render: (r) => <span className="truncate max-w-[200px] block text-xs">{r.address}</span>,
          },
          { key: "created_at", label: t("common.created"), render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        title={selected?.household_code ?? ""}
        subtitle={`Household #${selected?.id}`}
        actions={
          selected && canManage ? (
            <>
              <button className="btn" onClick={handleEditNotes}>
                <FileText size={14} /> {t("households.actions.notes")}
              </button>
              {selected.kyc_status !== "verified" && (
                <button className="btn btn-primary" onClick={handleApproveKYC}>
                  <ShieldCheck size={14} /> {t("households.actions.approveKyc")}
                </button>
              )}
              {selected.kyc_status === "verified" && (
                <button className="btn" onClick={handleForceKYCReview}>
                  <ShieldX size={14} /> {t("households.actions.forceReverify")}
                </button>
              )}
              {selected.status === "active" ? (
                <button className="btn btn-danger" onClick={handleSuspend} disabled={acting}>
                  <Ban size={14} /> {t("households.actions.suspend")}
                </button>
              ) : selected.status === "suspended" ? (
                <button className="btn btn-primary" onClick={handleReactivate} disabled={acting}>
                  <CheckCircle size={14} /> {t("households.actions.reactivate")}
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : detail ? (
          <>
            <DetailSection title={t("households.info")}>
              <DetailRow label={t("households.code")} value={detail.household.household_code} mono />
              <DetailRow label={t("common.status")} value={t(`common.${detail.household.status}`, detail.household.status)} badge={st} />
              <DetailRow label={t("households.kycStatus")} value={t(`common.${detail.household.kyc_status ?? "pending"}`, detail.household.kyc_status ?? "pending")} />
              <DetailRow label={t("households.kycTier")} value={t("households.tier", { n: detail.household.kyc_tier })} />
              <DetailRow label={t("households.region")} value={detail.household.location_segment} />
              <DetailRow label={t("households.province")} value={detail.household.province_code} />
              <DetailRow label={t("households.address")} value={detail.household.address} />
              <DetailRow label={t("households.telegramId")} value={String(detail.household.telegram_user_id)} mono />
              <DetailRow label={t("common.created")} value={new Date(detail.household.created_at).toLocaleString()} />
            </DetailSection>

            {detail.household.admin_notes && (
              <DetailSection title={t("households.adminNotes")}>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-2)" }}>
                  {detail.household.admin_notes}
                </p>
              </DetailSection>
            )}

            <DetailSection title={t("households.members", { count: detail.members?.length ?? 0 })}>
              {detail.members?.length > 0 ? (
                <div className="space-y-2">
                  {detail.members.map((m) => (
                    <div key={m.id} className="card p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>
                            {m.full_name}
                          </p>
                          <p className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
                            {m.national_code} · {m.relationship} · {m.gender}
                          </p>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: m.kyc_verified ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                            color: m.kyc_verified ? "var(--success)" : "var(--warning)",
                          }}
                        >
                          {m.kyc_verified ? "KYC ✓" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-3)" }}>
                  {t("households.noMembers")}
                </p>
              )}
            </DetailSection>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {t("errors.loadFailed")}
          </p>
        )}
      </DetailPanel>
    </>
  );
}
