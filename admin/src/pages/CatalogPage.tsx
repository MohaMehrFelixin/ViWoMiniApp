import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { api } from "../api/client";

interface CatalogRow { id: number; category: string; name: string; name_fa: string; icon: string; scope: string; region?: string; default_amount: number; unit_code: string; unit_name: string; }
const CAT_COLORS: Record<string, string> = { water: "#3b82f6", food: "#22c55e", fuel: "#f97316", hygiene: "#a855f7", medical: "#ef4444", energy: "#eab308" };

export function CatalogPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await api.get("catalog/items", { searchParams: { page, limit: 50 } }).json<{ items: CatalogRow[]; total: number }>();
    return { items: res.items ?? [], total: res.total };
  }, []);

  return (
    <PageShell<CatalogRow>
      title="Catalog Items"
      subtitle="Admin-defined products per category"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "icon", label: "", render: (r) => <span className="text-lg">{r.icon}</span> },
        { key: "name", label: "Name", render: (r) => <div><span className="font-medium">{r.name}</span><br/><span className="text-xs" style={{ color: "var(--text-3)" }}>{r.name_fa}</span></div> },
        { key: "category", label: "Category", render: (r) => <span className="badge" style={{ background: `${CAT_COLORS[r.category] ?? "#666"}18`, color: CAT_COLORS[r.category] }}>{r.category}</span> },
        { key: "default_amount", label: "Default Qty", render: (r) => <span className="font-mono text-xs">{r.default_amount} {r.unit_name}</span> },
        { key: "scope", label: "Scope", render: (r) => <span className="text-xs capitalize">{r.scope}{r.region ? ` (${r.region})` : ""}</span> },
      ]}
    />
  );
}
