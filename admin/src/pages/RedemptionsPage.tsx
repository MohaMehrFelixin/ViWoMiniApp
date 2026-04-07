import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import {
  listRedemptions,
  resolveDispute,
  reverseRedemption,
  type RedemptionRow,
} from "../api/admin";
import { CheckCircle, XCircle, Undo2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { promptDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const CAT_COLORS: Record<string, string> = {
  water: "#3b82f6",
  food: "#22c55e",
  fuel: "#f97316",
  hygiene: "#a855f7",
  medical: "#ef4444",
  energy: "#eab308",
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  completed: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  disputed: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  reversed: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  pending: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
};

export function RedemptionsPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RedemptionRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listRedemptions({ page: String(page), limit: "25" });
      return { items: res.redemptions, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleResolve = async (accepted: boolean) => {
    if (!selected) return;
    const resolution = await promptDialog({
      title: accepted ? t("redemptions.dialogs.acceptTitle") : t("redemptions.dialogs.rejectTitle"),
      message: accepted ? t("redemptions.dialogs.acceptMessage") : t("redemptions.dialogs.rejectMessage"),
      placeholder: t("redemptions.dialogs.resolutionPlaceholder"),
      multiline: true,
      required: true,
      variant: accepted ? "warning" : "default",
      confirmLabel: accepted ? t("redemptions.actions.acceptReverse") : t("redemptions.actions.rejectDispute"),
    });
    if (!resolution) return;
    setActing(true);
    try {
      await resolveDispute(selected.id, accepted, resolution);
      toast.success(accepted ? t("redemptions.toasts.accepted") : t("redemptions.toasts.rejected"));
      setSelected({ ...selected, status: accepted ? "reversed" : "completed" });
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  // Admin-initiated reversal independent of dispute flow.
  const handleReverse = async () => {
    if (!selected) return;
    const reason = await promptDialog({
      title: t("redemptions.dialogs.reverseTitle"),
      message: t("redemptions.dialogs.reverseMessage"),
      placeholder: t("redemptions.dialogs.reversePlaceholder"),
      multiline: true,
      required: true,
      variant: "danger",
      confirmLabel: t("redemptions.actions.forceReverse"),
    });
    if (!reason) return;
    setActing(true);
    try {
      await reverseRedemption(selected.id, reason);
      toast.success(t("redemptions.toasts.reversed"));
      setSelected({ ...selected, status: "reversed" });
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const ss = STATUS_COLORS[selected?.status ?? "completed"] ?? STATUS_COLORS.completed;
  const canResolveDispute = role >= 3;
  const canForceReverse = role >= 5;

  return (
    <>
      <PageShell<RedemptionRow>
        title={t("redemptions.title")}
        subtitle={t("redemptions.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "coupon_code", label: t("redemptions.couponCode"), render: (r) => <span className="font-mono text-xs">{r.coupon_code}</span> },
          {
            key: "household_id",
            label: t("redemptions.household"),
            render: (r) => <span className="font-mono text-xs">#{r.household_id}</span>,
          },
          {
            key: "category",
            label: t("redemptions.category"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}
              >
                {t(`settings.categories.${r.category}`, r.category)}
              </span>
            ),
          },
          { key: "amount", label: t("redemptions.amount") },
          {
            key: "status",
            label: t("common.status"),
            render: (r) => {
              const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.completed;
              return (
                <span className="badge" style={{ background: s.bg, color: s.color }}>
                  {t(`common.${r.status}`, r.status)}
                </span>
              );
            },
          },
          {
            key: "created_at",
            label: t("redemptions.time"),
            render: (r) =>
              new Date(r.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.coupon_code ?? ""}
        subtitle={`#${selected?.id ?? ""}`}
        actions={
          selected ? (
            <>
              {selected.status === "disputed" && canResolveDispute && (
                <>
                  <button className="btn btn-primary" onClick={() => handleResolve(true)} disabled={acting}>
                    <CheckCircle size={14} /> {t("redemptions.actions.acceptReverse")}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleResolve(false)} disabled={acting}>
                    <XCircle size={14} /> {t("redemptions.actions.rejectDispute")}
                  </button>
                </>
              )}
              {selected.status === "completed" && canForceReverse && (
                <button className="btn" onClick={handleReverse} disabled={acting}>
                  <Undo2 size={14} /> {t("redemptions.actions.forceReverse")}
                </button>
              )}
            </>
          ) : null
        }
      >
        {selected && (
          <DetailSection title={t("redemptions.redemptionDetails")}>
            <DetailRow label={t("redemptions.couponCode")} value={selected.coupon_code} mono />
            <DetailRow
              label={t("redemptions.category")}
              value={t(`settings.categories.${selected.category}`, selected.category)}
              badge={{
                color: CAT_COLORS[selected.category] ?? "#666",
                bg: `${CAT_COLORS[selected.category] ?? "#666"}18`,
              }}
            />
            <DetailRow label={t("redemptions.amount")} value={selected.amount} />
            <DetailRow label={t("common.status")} value={t(`common.${selected.status}`, selected.status)} badge={ss} />
            <DetailRow label={t("redemptions.household")} value={`#${selected.household_id}`} mono />
            <DetailRow label={t("redemptions.allocation")} value={`#${selected.allocation_id}`} mono />
            <DetailRow label={t("redemptions.center")} value={`#${selected.distribution_point_id}`} mono />
            <DetailRow label={t("common.created")} value={new Date(selected.created_at).toLocaleString()} />
          </DetailSection>
        )}
      </DetailPanel>
    </>
  );
}
