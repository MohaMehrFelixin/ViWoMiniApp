import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { DetailPanel, DetailSection, DetailRow } from "../components/DetailPanel";
import { Modal } from "../components/Modal";
import {
  listCenters,
  createCenter,
  updateCenter,
  updateCenterStock,
  deactivateCenter,
  type CenterRow,
} from "../api/admin";
import { Plus, Save, Package, Power } from "lucide-react";
import { useToast } from "../components/Toast";
import { confirmDialog } from "../components/Dialog";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_COLORS: Record<string, string> = {
  open: "#22c55e",
  closed: "#ef4444",
  low_stock: "#f59e0b",
  out_of_stock: "#ef4444",
};

const STOCK_LEVELS = ["full", "low", "out"];
const CATEGORIES = ["water", "food", "fuel", "hygiene", "medical", "energy"];

interface FormState {
  name: string;
  type: string;
  address: string;
  lat: string;
  lng: string;
  province_code: string;
  operating_hours: string;
}

function emptyForm(): FormState {
  return {
    name: "",
    type: "store",
    address: "",
    lat: "0",
    lng: "0",
    province_code: "",
    operating_hours: "08:00-18:00",
  };
}

export function CentersPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<CenterRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canManage = role >= 3;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listCenters({ page: String(page), limit: "25" });
      return { items: res.centers, total: res.total };
    },
    [refreshKey]
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSelect = (row: CenterRow) => {
    setSelected(row);
    setStockEdits(row.stock_status ?? {});
  };

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.province_code) {
      toast.error(t("centers.validation.required"));
      return;
    }
    setActing(true);
    try {
      await createCenter({
        name: form.name,
        type: form.type,
        address: form.address,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        province_code: form.province_code,
        operating_hours: form.operating_hours,
        status: "open",
      });
      toast.success(t("centers.toasts.created"));
      setCreating(false);
      setForm(emptyForm());
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.createFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleSaveStock = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await updateCenterStock(selected.id, stockEdits);
      toast.success(t("centers.toasts.stockUpdated"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.updateFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleSaveCenter = async () => {
    if (!selected) return;
    setActing(true);
    try {
      await updateCenter(selected.id, {
        name: selected.name,
        address: selected.address,
        operating_hours: selected.operating_hours,
        status: selected.status,
      });
      toast.success(t("centers.toasts.saved"));
      refresh();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.saveFailed")));
    } finally {
      setActing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    const ok = await confirmDialog({
      title: t("centers.deactivateDialog.title"),
      message: t("centers.deactivateDialog.message"),
      variant: "danger",
      confirmLabel: t("centers.deactivateDialog.confirm"),
    });
    if (!ok) return;
    setActing(true);
    try {
      await deactivateCenter(selected.id);
      toast.success(t("centers.toasts.deactivated"));
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
      <PageShell<CenterRow>
        title={t("centers.title")}
        subtitle={t("centers.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        onRowClick={handleSelect}
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> {t("centers.addCenter")}
            </button>
          ) : null
        }
        columns={[
          { key: "name", label: t("centers.name"), render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "type", label: t("centers.type"), render: (r) => <span className="text-xs">{t(`centers.types.${r.type}`, r.type)}</span> },
          {
            key: "status",
            label: t("common.status"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}
              >
                {t(`common.${r.status}`, r.status.replace(/_/g, " "))}
              </span>
            ),
          },
          { key: "operating_hours", label: t("centers.hours") },
          {
            key: "address",
            label: t("centers.address"),
            render: (r) => <span className="max-w-[200px] truncate block text-xs">{r.address}</span>,
          },
          {
            key: "province_code",
            label: t("centers.province"),
            render: (r) => <span className="font-mono text-xs">{r.province_code}</span>,
          },
        ]}
      />

      {/* Create modal — uses shared Modal component which adapts to mobile */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("centers.newCenterTitle")}
        maxWidth={560}
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
            placeholder={t("centers.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="store">{t("centers.types.store")}</option>
            <option value="hospital">{t("centers.types.hospital")}</option>
            <option value="warehouse">{t("centers.types.warehouse")}</option>
            <option value="mobile">{t("centers.types.mobile")}</option>
            <option value="charging_station">{t("centers.types.charging_station")}</option>
          </select>
          <input
            className="input"
            placeholder={t("centers.address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder={t("centers.lat")}
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder={t("centers.lng")}
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </div>
          <input
            className="input"
            placeholder={t("centers.provinceCode")}
            value={form.province_code}
            onChange={(e) => setForm({ ...form, province_code: e.target.value })}
          />
          <input
            className="input"
            placeholder={t("centers.operatingHours")}
            value={form.operating_hours}
            onChange={(e) => setForm({ ...form, operating_hours: e.target.value })}
          />
        </div>
      </Modal>

      <DetailPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={`Center #${selected?.id}`}
        actions={
          selected && canManage ? (
            <>
              <button className="btn btn-primary" onClick={handleSaveCenter} disabled={acting}>
                <Save size={14} /> {t("common.save")}
              </button>
              <button className="btn btn-danger" onClick={handleDeactivate} disabled={acting}>
                <Power size={14} /> {t("centers.deactivate")}
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <>
            <DetailSection title={t("centers.centerDetails")}>
              <div className="space-y-2">
                <input
                  className="input"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  placeholder={t("centers.name")}
                />
                <input
                  className="input"
                  value={selected.address}
                  onChange={(e) => setSelected({ ...selected, address: e.target.value })}
                  placeholder={t("centers.address")}
                />
                <input
                  className="input"
                  value={selected.operating_hours}
                  onChange={(e) => setSelected({ ...selected, operating_hours: e.target.value })}
                  placeholder={t("centers.operatingHours")}
                />
                <select
                  className="input"
                  value={selected.status}
                  onChange={(e) => setSelected({ ...selected, status: e.target.value })}
                >
                  <option value="open">{t("common.open")}</option>
                  <option value="low_stock">{t("centers.stockLevels.low")}</option>
                  <option value="out_of_stock">{t("centers.stockLevels.out")}</option>
                  <option value="closed">{t("common.closed")}</option>
                </select>
              </div>
              <DetailRow label={t("centers.type")} value={t(`centers.types.${selected.type}`, selected.type)} />
              <DetailRow label={t("centers.province")} value={selected.province_code} mono />
              <DetailRow label={t("centers.coordinates")} value={`${selected.lat}, ${selected.lng}`} mono />
            </DetailSection>

            <DetailSection title={t("centers.stockStatus")}>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs flex-1" style={{ color: "var(--text-2)" }}>
                      {t(`settings.categories.${cat}`, cat)}
                    </span>
                    <select
                      className="input"
                      style={{ width: 120 }}
                      value={stockEdits[cat] ?? "full"}
                      onChange={(e) => setStockEdits({ ...stockEdits, [cat]: e.target.value })}
                    >
                      {STOCK_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {t(`centers.stockLevels.${l}`, l)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary mt-4" onClick={handleSaveStock} disabled={acting}>
                <Package size={14} /> {t("centers.saveStock")}
              </button>
            </DetailSection>
          </>
        )}
      </DetailPanel>
    </>
  );
}
