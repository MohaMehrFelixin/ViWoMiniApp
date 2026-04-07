import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailRow, DetailSection } from "../components/DetailPanel";
import { listPowerBanks, forceSwapStatus, type SwapRow } from "../api/admin";
import { Settings as SettingsIcon, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { promptDialog, confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  ready: "#3b82f6",
  picked_up: "#22c55e",
  returned: "#6b7280",
  cancelled: "#ef4444",
  expired: "#6b7280",
};

const ALL_STATUSES = ["pending", "ready", "picked_up", "returned", "cancelled", "expired"];

export function PowerBanksPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<SwapRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canForce = role >= 3;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listPowerBanks({ page: String(page), limit: "25" });
      return { items: res.swaps, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleForce = async (newStatus: string) => {
    if (!selected) return;
    const localStatus = t(`powerBanks.statuses.${newStatus}`, newStatus.replace(/_/g, " "));
    const notes = await promptDialog({
      title: t("powerBanks.forceTitle", { status: localStatus }),
      message: t("powerBanks.forceMessage"),
      placeholder: t("powerBanks.forcePlaceholder"),
      multiline: true,
      required: true,
      variant: "warning",
    });
    if (!notes) return;
    setActing(true);
    try {
      await forceSwapStatus(selected.id, newStatus, notes);
      toast.success(t("powerBanks.toasts.statusChanged", { status: localStatus }));
      setSelected({ ...selected, status: newStatus });
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("powerBanks.cancelTitle"),
      message: t("powerBanks.cancelMessage"),
      variant: "danger",
      confirmLabel: t("powerBanks.cancelTitle"),
    });
    if (!ok) return;
    setActing(true);
    try {
      await forceSwapStatus(selected.id, "cancelled", "Admin force cancel");
      toast.success(t("powerBanks.toasts.cancelled"));
      setSelected({ ...selected, status: "cancelled" });
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageShell<SwapRow>
        title={t("powerBanks.title")}
        subtitle={t("powerBanks.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          {
            key: "swap_code",
            label: t("powerBanks.code"),
            render: (r) => <span className="font-mono text-xs font-semibold">{r.swap_code}</span>,
          },
          {
            key: "household_id",
            label: t("powerBanks.household"),
            render: (r) => <span className="font-mono text-xs">#{r.household_id}</span>,
          },
          {
            key: "status",
            label: t("common.status"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}
              >
                {t(`powerBanks.statuses.${r.status}`, r.status.replace(/_/g, " "))}
              </span>
            ),
          },
          {
            key: "created_at",
            label: t("common.created"),
            render: (r) => new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          },
          {
            key: "updated_at",
            label: t("common.updated"),
            render: (r) => new Date(r.updated_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.swap_code ?? ""}
        subtitle={`#${selected?.id ?? ""}`}
        actions={
          selected && canForce && selected.status !== "cancelled" && selected.status !== "returned" ? (
            <button className="btn btn-danger" onClick={handleCancel} disabled={acting}>
              <X size={14} /> {t("powerBanks.forceCancel")}
            </button>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title={t("powerBanks.swapDetails")}>
              <DetailRow label={t("powerBanks.code")} value={selected.swap_code} mono />
              <DetailRow label={t("powerBanks.household")} value={`#${selected.household_id}`} mono />
              <DetailRow label={t("common.status")} value={t(`powerBanks.statuses.${selected.status}`, selected.status)} />
              <DetailRow label={t("common.created")} value={new Date(selected.created_at).toLocaleString()} />
              <DetailRow label={t("common.updated")} value={new Date(selected.updated_at).toLocaleString()} />
            </DetailSection>
            {canForce && (
              <DetailSection title={t("powerBanks.overrideStatus")}>
                <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>
                  {t("powerBanks.overrideHint")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATUSES.filter((s) => s !== selected.status).map((s) => (
                    <button key={s} className="btn" onClick={() => handleForce(s)} disabled={acting}>
                      <SettingsIcon size={12} /> {t(`powerBanks.statuses.${s}`, s.replace(/_/g, " "))}
                    </button>
                  ))}
                </div>
              </DetailSection>
            )}
          </>
        )}
      </DetailPanel>
    </>
  );
}
