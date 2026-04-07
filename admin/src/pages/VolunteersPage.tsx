import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailRow, DetailSection } from "../components/DetailPanel";
import {
  listVolunteers,
  approveVolunteer,
  rejectVolunteer,
  type VolunteerRow,
} from "../api/admin";
import { CheckCircle, XCircle } from "lucide-react";
import { useToast } from "../components/Toast";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  approved: { color: "var(--success)", bg: "rgba(34,197,94,0.15)" },
  pending: { color: "var(--warning)", bg: "rgba(245,158,11,0.15)" },
  rejected: { color: "var(--danger)", bg: "rgba(239,68,68,0.15)" },
  suspended: { color: "var(--text-3)", bg: "rgba(107,114,128,0.15)" },
};

export function VolunteersPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<VolunteerRow | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canManage = role >= 7;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listVolunteers({ page: String(page), limit: "25" });
      return { items: res.volunteers, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleApprove = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await approveVolunteer(selected.id);
      toast.success(t("volunteers.approveSuccess"));
      setSelected({ ...selected, status: "approved" });
      refresh();
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
      await rejectVolunteer(selected.id);
      toast.success(t("volunteers.rejectSuccess"));
      setSelected({ ...selected, status: "rejected" });
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.rejectFailed")));
    } finally {
      setActing(false);
    }
  };

  const ss = STATUS_COLORS[selected?.status ?? "pending"] ?? STATUS_COLORS.pending;

  return (
    <>
      <PageShell<VolunteerRow>
        title={t("volunteers.title")}
        subtitle={t("volunteers.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        columns={[
          { key: "full_name", label: t("volunteers.name"), render: (r) => <span className="font-medium">{r.full_name}</span> },
          {
            key: "specialty",
            label: t("volunteers.specialty"),
            render: (r) => <span className="text-xs capitalize">{(r.specialty ?? "general").replace(/_/g, " ")}</span>,
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
          { key: "created_at", label: t("volunteers.applied"), render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? ""}
        subtitle={`#${selected?.id ?? ""}`}
        actions={
          selected && canManage && selected.status === "pending" ? (
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
          <DetailSection title={t("volunteers.info")}>
            <DetailRow label={t("volunteers.name")} value={selected.full_name} />
            <DetailRow label={t("volunteers.specialty")} value={(selected.specialty ?? "general").replace(/_/g, " ")} />
            <DetailRow label={t("common.status")} value={t(`common.${selected.status}`, selected.status)} badge={ss} />
            <DetailRow label={t("volunteers.applied")} value={new Date(selected.created_at).toLocaleString()} />
          </DetailSection>
        )}
      </DetailPanel>
    </>
  );
}
