import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailRow, DetailSection } from "../components/DetailPanel";
import { Modal } from "../components/Modal";
import {
  listAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
} from "../api/admin";
import { ROLE_TITLES, type AdminUser } from "../lib/types";
import { Plus, Save, Power } from "lucide-react";
import { useToast } from "../components/Toast";
import { confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  suspended: "#ef4444",
  deactivated: "#6b7280",
};

interface CreateForm {
  national_code: string;
  full_name: string;
  phone: string;
  role_level: number;
  province_codes: string;
}

function emptyForm(): CreateForm {
  return { national_code: "", full_name: "", phone: "", role_level: 1, province_codes: "" };
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.admin);
  const myLevel = me?.role_level ?? 0;
  const [refreshKey, setRefreshKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [acting, setActing] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listAdmins(page, 25);
      return { items: res.admins, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleCreate = async () => {
    if (!form.national_code || !form.full_name || !form.phone) {
      toast.error(t("users.validation.fieldsRequired"));
      return;
    }
    if (form.role_level >= myLevel) {
      toast.error(t("users.validation.tooHigh"));
      return;
    }
    setActing(true);
    try {
      await createAdmin({
        national_code: form.national_code,
        full_name: form.full_name,
        phone: form.phone,
        role_level: form.role_level,
        province_codes: form.province_codes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success(t("users.toasts.created"));
      setCreating(false);
      setForm(emptyForm());
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.createFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const updated = await updateAdmin(selected.id, {
        full_name: selected.full_name,
        phone: selected.phone,
        role_level: selected.role_level,
        province_codes: selected.province_codes,
        status: selected.status,
      });
      setSelected(updated);
      toast.success(t("users.toasts.updated"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.updateFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("users.deactivateDialog.title"),
      message: t("users.deactivateDialog.message"),
      variant: "danger",
      confirmLabel: t("users.deactivateDialog.confirm"),
    });
    if (!ok) return;
    setActing(true);
    try {
      await deactivateAdmin(selected.id);
      toast.success(t("users.toasts.deactivated"));
      setSelected(null);
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.actionFailed")));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageShell<AdminUser>
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={setSelected}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> {t("users.addAdmin")}
          </button>
        }
        columns={[
          {
            key: "full_name",
            label: t("users.name"),
            render: (r) => <span className="font-medium">{r.full_name}</span>,
          },
          {
            key: "national_code",
            label: t("users.nationalCodeLabel"),
            render: (r) => <span className="font-mono text-xs">{r.national_code}</span>,
          },
          {
            key: "role_level",
            label: t("users.role"),
            render: (r) => (
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 min-w-[20px] items-center justify-center rounded text-[10px] font-bold"
                  style={{ background: "rgba(59,130,246,0.15)", color: "var(--accent)" }}
                >
                  L{r.role_level}
                </span>
                <span className="text-xs">{ROLE_TITLES[r.role_level]}</span>
              </div>
            ),
          },
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
          {
            key: "last_login_at",
            label: t("common.lastLogin"),
            render: (r) =>
              r.last_login_at ? (
                new Date(r.last_login_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              ) : (
                <span style={{ color: "var(--text-3)" }}>{t("common.never")}</span>
              ),
          },
        ]}
      />

      {/* Create modal — uses shared Modal component */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("users.newAdminTitle")}
        maxWidth={480}
        footer={
          <>
            <button className="btn" onClick={() => setCreating(false)} style={{ flex: 1 }}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={acting}
              style={{ flex: 1 }}
            >
              {t("common.create")}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            className="input"
            inputMode="numeric"
            placeholder={t("users.nationalCodePlaceholder")}
            value={form.national_code}
            onChange={(e) =>
              setForm({ ...form, national_code: e.target.value.replace(/\D/g, "").slice(0, 10) })
            }
          />
          <input
            className="input"
            placeholder={t("users.namePlaceholder")}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <input
            className="input"
            type="tel"
            inputMode="tel"
            placeholder={t("users.phonePlaceholder")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <select
            className="input"
            value={form.role_level}
            onChange={(e) => setForm({ ...form, role_level: parseInt(e.target.value) })}
          >
            {Array.from({ length: myLevel - 1 }, (_, i) => i + 1).map((lv) => (
              <option key={lv} value={lv}>
                L{lv} — {ROLE_TITLES[lv]}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder={t("users.provinceCodesPlaceholder")}
            value={form.province_codes}
            onChange={(e) => setForm({ ...form, province_codes: e.target.value })}
          />
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            {t("users.provinceHint")}
          </p>
        </div>
      </Modal>

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? ""}
        subtitle={`Admin #${selected?.id} · L${selected?.role_level}`}
        actions={
          selected && selected.id !== me?.id && myLevel > selected.role_level ? (
            <>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={acting}>
                <Save size={14} /> {t("common.save")}
              </button>
              <button className="btn btn-danger" onClick={handleDeactivate} disabled={acting}>
                <Power size={14} /> {t("users.deactivateDialog.confirm")}
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <DetailSection title={t("users.profile")}>
            <input
              className="input"
              value={selected.full_name}
              onChange={(e) => setSelected({ ...selected, full_name: e.target.value })}
              placeholder={t("users.namePlaceholder")}
            />
            <input
              className="input"
              value={selected.phone}
              onChange={(e) => setSelected({ ...selected, phone: e.target.value })}
              placeholder={t("users.phonePlaceholder")}
            />
            <select
              className="input"
              value={selected.role_level}
              onChange={(e) => setSelected({ ...selected, role_level: parseInt(e.target.value) })}
            >
              {Array.from({ length: myLevel - 1 }, (_, i) => i + 1).map((lv) => (
                <option key={lv} value={lv}>
                  L{lv} — {ROLE_TITLES[lv]}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={selected.province_codes.join(", ")}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  province_codes: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={t("users.provinceCodesPlaceholder")}
            />
            <select
              className="input"
              value={selected.status}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  status: e.target.value as "active" | "suspended" | "deactivated",
                })
              }
            >
              <option value="active">{t("common.active")}</option>
              <option value="suspended">{t("common.suspended")}</option>
              <option value="deactivated">{t("common.deactivated")}</option>
            </select>
            <DetailRow label={t("users.nationalCodeLabel")} value={selected.national_code} mono />
            <DetailRow label={t("common.created")} value={new Date(selected.created_at).toLocaleString()} />
            <DetailRow
              label={t("common.lastLogin")}
              value={selected.last_login_at ? new Date(selected.last_login_at).toLocaleString() : t("common.never")}
            />
          </DetailSection>
        )}
      </DetailPanel>
    </>
  );
}
