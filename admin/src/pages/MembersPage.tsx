import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import {
  listMembers,
  verifyMemberKYC,
  bulkVerifyMembers,
  deleteMember,
  type MemberRow,
} from "../api/admin";
import { ShieldCheck, CheckSquare, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

export function MembersPage() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [acting, setActing] = useState(false);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canVerify = role >= 4;
  const canDelete = role >= 5;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listMembers({ page: String(page), limit: "25" });
      return { items: res.members, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    setSelected(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleVerifyOne = async (id: number) => {
    setActing(true);
    try {
      await verifyMemberKYC(id);
      toast.success(t("members.verifySuccess"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("members.verifyFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleBulkVerify = async () => {
    if (selected.size === 0) return;
    const ok = await confirmDialog({
      title: t("members.bulkVerifyTitle", { count: selected.size }),
      message: t("members.bulkVerifyMessage"),
      confirmLabel: t("members.bulkVerifyConfirm"),
    });
    if (!ok) return;
    setActing(true);
    try {
      const res = await bulkVerifyMembers(Array.from(selected));
      toast.success(t("members.bulkVerifySuccess", { count: res.verified_count }));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("members.bulkVerifyFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirmDialog({
      title: t("members.deleteTitle"),
      message: t("members.deleteMessage"),
      confirmLabel: t("members.deleteConfirm"),
      variant: "danger",
    });
    if (!ok) return;
    setActing(true);
    try {
      await deleteMember(id);
      toast.success(t("members.deleteSuccess"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("members.deleteFailed")));
    } finally {
      setActing(false);
    }
  };

  return (
    <PageShell<MemberRow>
      title={t("members.title")}
      subtitle={t("members.subtitle")}
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      actions={
        canVerify && selected.size > 0 ? (
          <button className="btn btn-primary" onClick={handleBulkVerify} disabled={acting}>
            <CheckSquare size={14} /> {t("members.bulkVerify", { count: selected.size })}
          </button>
        ) : null
      }
      columns={[
        ...(canVerify
          ? [
              {
                key: "_select",
                label: "",
                render: (r: MemberRow) => (
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(r.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
              },
            ]
          : []),
        { key: "full_name", label: t("members.name"), render: (r: MemberRow) => <span className="font-medium">{r.full_name}</span> },
        {
          key: "national_code",
          label: t("members.nationalCode"),
          render: (r: MemberRow) => <span className="font-mono text-xs">{r.national_code}</span>,
        },
        { key: "relationship", label: t("members.relationship"), render: (r: MemberRow) => <span className="text-xs capitalize">{r.relationship}</span> },
        { key: "gender", label: t("members.gender"), render: (r: MemberRow) => <span className="text-xs capitalize">{r.gender}</span> },
        {
          key: "age_group",
          label: t("members.ageGroup"),
          render: (r: MemberRow) => <span className="text-xs">{t(`settings.ageGroups.${r.age_group}`, r.age_group.replace(/_/g, " "))}</span>,
        },
        {
          key: "kyc_verified",
          label: t("members.kyc"),
          render: (r: MemberRow) => (
            <span
              className="badge"
              style={{
                background: r.kyc_verified ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                color: r.kyc_verified ? "var(--success)" : "var(--warning)",
              }}
            >
              {r.kyc_verified ? t("common.verified") : t("common.pending")}
            </span>
          ),
        },
        {
          key: "_actions",
          label: "",
          render: (r: MemberRow) => (
            <div className="flex gap-1 justify-end">
              {canVerify && !r.kyc_verified && (
                <button
                  className="btn"
                  style={{ padding: "4px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleVerifyOne(r.id);
                  }}
                  disabled={acting}
                  title={t("members.verifyTooltip")}
                >
                  <ShieldCheck size={12} />
                </button>
              )}
              {canDelete && (
                <button
                  className="btn btn-danger"
                  style={{ padding: "4px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(r.id);
                  }}
                  disabled={acting}
                  title={t("members.deleteTooltip")}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
