import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import {
  listAllocations,
  adjustAllocation,
  pauseAllocation,
  resumeAllocation,
  expireAllocation,
  type AllocationRow,
} from "../api/admin";
import { Pencil, Pause, Play, AlertCircle } from "lucide-react";
import { useToast } from "../components/Toast";
import { promptDialog, confirmDialog } from "../components/Dialog";
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

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  expired: "#6b7280",
  exhausted: "#ef4444",
};

export function AllocationsPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AllocationRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canEdit = role >= 5;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listAllocations({ page: String(page), limit: "25" });
      return { items: res.allocations, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleAdjust = async () => {
    if (!selected) return;
    const amount = await promptDialog({
      title: t("allocations.dialogs.adjustTitle"),
      message: t("allocations.dialogs.adjustMessage", {
        total: selected.total_amount,
        used: selected.used_amount,
      }),
      defaultValue: selected.total_amount,
      placeholder: t("allocations.dialogs.adjustPlaceholder"),
      required: true,
    });
    if (amount === null || amount === "") return;
    if (isNaN(parseFloat(amount)) || parseFloat(amount) < parseFloat(selected.used_amount)) {
      toast.error(t("allocations.toasts.amountInvalid", { min: selected.used_amount }));
      return;
    }
    const reason = await promptDialog({
      title: t("allocations.dialogs.reasonTitle"),
      message: t("allocations.dialogs.reasonMessage"),
      placeholder: t("allocations.dialogs.reasonPlaceholder"),
      multiline: true,
      required: true,
    });
    if (!reason) return;
    setActing(true);
    try {
      await adjustAllocation(selected.id, amount, reason);
      toast.success(t("allocations.toasts.adjusted"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handlePause = async () => {
    if (!selected) return;
    const reason = await promptDialog({
      title: t("allocations.dialogs.pauseTitle"),
      message: t("allocations.dialogs.pauseMessage"),
      placeholder: t("allocations.dialogs.pausePlaceholder"),
      multiline: true,
      required: true,
      variant: "warning",
    });
    if (!reason) return;
    setActing(true);
    try {
      await pauseAllocation(selected.id, reason);
      toast.success(t("allocations.toasts.paused"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleResume = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await resumeAllocation(selected.id);
      toast.success(t("allocations.toasts.resumed"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleExpire = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("allocations.dialogs.expireTitle"),
      message: t("allocations.dialogs.expireMessage"),
      confirmLabel: t("allocations.dialogs.expireConfirm"),
      variant: "danger",
    });
    if (!ok) return;
    setActing(true);
    try {
      await expireAllocation(selected.id);
      toast.success(t("allocations.toasts.expired"));
      refresh();
      setSelected(null);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageShell<AllocationRow>
        title={t("allocations.title")}
        subtitle={t("allocations.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          {
            key: "household_id",
            label: t("allocations.household"),
            render: (r) => <span className="font-mono text-xs">#{r.household_id}</span>,
          },
          {
            key: "category",
            label: t("allocations.category"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}
              >
                {t(`settings.categories.${r.category}`, r.category)}
              </span>
            ),
          },
          { key: "total_amount", label: t("allocations.totalAmount"), render: (r) => <span className="font-mono text-xs">{r.total_amount}</span> },
          { key: "used_amount", label: t("allocations.usedAmount"), render: (r) => <span className="font-mono text-xs">{r.used_amount}</span> },
          {
            key: "remaining_amount",
            label: t("allocations.remainingAmount"),
            render: (r) => <span className="font-mono text-xs font-semibold">{r.remaining_amount}</span>,
          },
          { key: "current_week", label: t("allocations.currentWeek"), render: (r) => <span>{t("allocations.weekShort", { n: r.current_week })}</span> },
          {
            key: "status",
            label: t("common.status"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}
              >
                {t(`common.${r.status}`, r.status)}
              </span>
            ),
          },
        ]}
      />
      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`#${selected?.id ?? ""}`}
        subtitle={
          selected
            ? `${t(`settings.categories.${selected.category}`, selected.category)} · ${t("allocations.household")} #${selected.household_id}`
            : ""
        }
        actions={
          selected && canEdit && selected.status === "active" ? (
            <>
              <button className="btn" onClick={handleAdjust} disabled={acting}>
                <Pencil size={14} /> {t("allocations.actions.adjust")}
              </button>
              <button className="btn" onClick={handlePause} disabled={acting}>
                <Pause size={14} /> {t("allocations.actions.pause")}
              </button>
              <button className="btn btn-danger" onClick={handleExpire} disabled={acting}>
                <AlertCircle size={14} /> {t("allocations.actions.expire")}
              </button>
            </>
          ) : selected && canEdit ? (
            <button className="btn btn-primary" onClick={handleResume} disabled={acting}>
              <Play size={14} /> {t("allocations.actions.resume")}
            </button>
          ) : null
        }
      >
        {selected && (
          <DetailSection title={t("allocations.title")}>
            <DetailRow label="ID" value={String(selected.id)} mono />
            <DetailRow label={t("allocations.household")} value={`#${selected.household_id}`} mono />
            <DetailRow label={t("allocations.category")} value={t(`settings.categories.${selected.category}`, selected.category)} />
            <DetailRow label={t("allocations.totalAmount")} value={selected.total_amount} mono />
            <DetailRow label={t("allocations.usedAmount")} value={selected.used_amount} mono />
            <DetailRow label={t("allocations.remainingAmount")} value={selected.remaining_amount} mono />
            <DetailRow label={t("allocations.currentWeek")} value={t("allocations.weekShort", { n: selected.current_week })} />
            <DetailRow label={t("common.status")} value={t(`common.${selected.status}`, selected.status)} />
            <DetailRow label={t("common.created")} value={new Date(selected.created_at).toLocaleString()} />
          </DetailSection>
        )}
      </DetailPanel>
    </>
  );
}
