import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { listProviders, approveProvider, rejectProvider, type ProviderRow } from "../api/admin";
import { CheckCircle, XCircle } from "lucide-react";
import { useToast } from "../components/Toast";
import { extractErrorMessage } from "../lib/errors";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  approved: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  suspended: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

export function ProvidersPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ProviderRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listProviders({ page: String(page), limit: "25" });
      return { items: res.providers, total: res.total };
    },
    [refreshKey]
  );

  const handleApprove = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await approveProvider(selected.id);
      toast.success(t("providers.approveSuccess"));
      setSelected({ ...selected, status: "approved" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.approveFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await rejectProvider(selected.id);
      toast.success(t("providers.rejectSuccess"));
      setSelected({ ...selected, status: "rejected" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.rejectFailed")));
    } finally {
      setActing(false);
    }
  };

  const ss = STATUS_COLORS[selected?.status ?? "pending"] ?? STATUS_COLORS.pending;

  return (
    <>
      <PageShell<ProviderRow>
        title={t("providers.title")}
        subtitle={t("providers.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "name", label: t("providers.name"), render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "type", label: t("providers.type"), render: (r) => <span className="text-xs capitalize">{String(r.type).replace(/_/g, " ")}</span> },
          { key: "service_type", label: t("providers.service"), render: (r) => <span className="text-xs capitalize">{String(r.service_type).replace(/_/g, " ")}</span> },
          { key: "status", label: t("common.status"), render: (r) => { const s = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending; return <span className="badge" style={{ background: s.bg, color: s.color }}>{t(`common.${r.status}`, r.status)}</span>; } },
          { key: "store_address", label: t("centers.address"), render: (r) => <span className="max-w-[200px] truncate block text-xs">{r.store_address}</span> },
          { key: "created_at", label: t("common.created"), render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={`#${selected?.id ?? ""}`}
        actions={
          selected?.status === "pending" ? (
            <>
              <button className="btn btn-primary" onClick={handleApprove} disabled={acting}>
                <CheckCircle size={14} /> {t("kycReview.approve")}
              </button>
              <button className="btn btn-danger" onClick={handleReject} disabled={acting}>
                <XCircle size={14} /> {t("kycReview.reject")}
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title={t("providers.info")}>
              <DetailRow label={t("providers.name")} value={selected.name} />
              {selected.name_fa && <DetailRow label={t("providers.nameFa")} value={selected.name_fa} />}
              <DetailRow label={t("providers.type")} value={String(selected.type).replace(/_/g, " ")} />
              <DetailRow label={t("providers.service")} value={String(selected.service_type).replace(/_/g, " ")} />
              <DetailRow label={t("common.status")} value={t(`common.${selected.status}`, selected.status)} badge={ss} />
              <DetailRow label={t("centers.address")} value={selected.store_address} />
              <DetailRow label={t("providers.applied")} value={new Date(selected.created_at).toLocaleString()} />
            </DetailSection>
          </>
        )}
      </DetailPanel>
    </>
  );
}
