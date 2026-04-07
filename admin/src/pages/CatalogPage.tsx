import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/PageShell";
import { Modal } from "../components/Modal";
import { listCatalogItems, createCatalogItem, type CatalogRow } from "../api/admin";
import { Plus } from "lucide-react";
import { useToast } from "../components/Toast";
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

const CATEGORIES = ["water", "food", "fuel", "hygiene", "medical", "energy"];
const COMMON_UNITS = [
  { code: "kg", name: "kilogram" },
  { code: "g", name: "gram" },
  { code: "L", name: "liter" },
  { code: "ml", name: "milliliter" },
  { code: "pcs", name: "pieces" },
  { code: "pack", name: "package" },
];

interface CatalogForm {
  category: string;
  name: string;
  name_fa: string;
  icon: string;
  scope: "national" | "regional";
  region: string;
  default_amount: string;
  unit_code: string;
}

function emptyForm(): CatalogForm {
  return {
    category: "food",
    name: "",
    name_fa: "",
    icon: "🍞",
    scope: "national",
    region: "tehran",
    default_amount: "1",
    unit_code: "kg",
  };
}

export function CatalogPage() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CatalogForm>(emptyForm());
  const [acting, setActing] = useState(false);
  const toast = useToast();
  const role = useAuthStore((s) => s.admin?.role_level ?? 0);
  const canCreate = role >= 5;

  const fetchData = useCallback(
    async (page: number) => {
      void refreshKey;
      const res = await listCatalogItems({ page: String(page), limit: "50" });
      return { items: res.items, total: res.total };
    },
    [refreshKey]
  );

  const handleCreate = async () => {
    if (!form.name || !form.name_fa) {
      toast.error(t("catalog.validation.nameRequired"));
      return;
    }
    const amt = parseFloat(form.default_amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error(t("catalog.validation.amountInvalid"));
      return;
    }
    setActing(true);
    try {
      await createCatalogItem({
        category: form.category,
        name: form.name,
        name_fa: form.name_fa,
        icon: form.icon,
        scope: form.scope,
        region: form.scope === "regional" ? form.region : undefined,
        default_amount: amt,
        unit_code: form.unit_code,
      });
      toast.success(t("catalog.created"));
      setCreating(false);
      setForm(emptyForm());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.createFailed")));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageShell<CatalogRow>
        title={t("catalog.title")}
        subtitle={t("catalog.subtitle")}
        getRowKey={(r) => r.id}
        fetchData={fetchData}
        actions={
          canCreate ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> {t("catalog.addItem")}
            </button>
          ) : null
        }
        columns={[
          { key: "icon", label: "", render: (r) => <span className="text-lg">{r.icon}</span> },
          {
            key: "name",
            label: t("catalog.name"),
            render: (r) => (
              <div>
                <span className="font-medium">{r.name}</span>
                <br />
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  {r.name_fa}
                </span>
              </div>
            ),
          },
          {
            key: "category",
            label: t("catalog.category"),
            render: (r) => (
              <span
                className="badge"
                style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}
              >
                {t(`settings.categories.${r.category}`, r.category)}
              </span>
            ),
          },
          {
            key: "default_amount",
            label: t("catalog.defaultQty"),
            render: (r) => (
              <span className="font-mono text-xs">
                {r.default_amount} {r.unit_name}
              </span>
            ),
          },
          {
            key: "scope",
            label: t("catalog.scope"),
            render: (r) => (
              <span className="text-xs">
                {t(`common.${r.scope}`, r.scope)}
                {r.region ? ` (${t(`common.${r.region}`, r.region)})` : ""}
              </span>
            ),
          },
        ]}
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("catalog.newItemTitle")}
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
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`settings.categories.${c}`, c)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              className="input"
              style={{ width: 80, flexShrink: 0 }}
              placeholder={t("catalog.iconPlaceholder")}
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
            <input
              className="input"
              placeholder={t("catalog.namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <input
            className="input"
            placeholder={t("catalog.nameFaPlaceholder")}
            dir="rtl"
            value={form.name_fa}
            onChange={(e) => setForm({ ...form, name_fa: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder={t("catalog.amountPlaceholder")}
              value={form.default_amount}
              onChange={(e) => setForm({ ...form, default_amount: e.target.value })}
            />
            <select
              className="input"
              style={{ width: 120, flexShrink: 0 }}
              value={form.unit_code}
              onChange={(e) => setForm({ ...form, unit_code: e.target.value })}
            >
              {COMMON_UNITS.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code}
                </option>
              ))}
            </select>
          </div>
          <select
            className="input"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as "national" | "regional" })}
          >
            <option value="national">{t("common.global")}</option>
            <option value="regional">{t("common.regional")}</option>
          </select>
          {form.scope === "regional" && (
            <select
              className="input"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            >
              <option value="tehran">{t("common.tehran")}</option>
              <option value="urban">{t("common.urban")}</option>
              <option value="rural">{t("common.rural")}</option>
            </select>
          )}
        </div>
      </Modal>
    </>
  );
}
