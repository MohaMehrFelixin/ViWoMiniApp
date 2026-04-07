import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { getItemAllocations } from "../api/coupon";
import type { ItemAllocationView, CouponCategory } from "../lib/types";
import { toPersianDigits } from "../lib/utils";

function ItemRow({ item, isFa }: { item: ItemAllocationView; isFa: boolean }) {
  const alloc = parseFloat(item.allocated_amount);
  const used = parseFloat(item.used_amount);
  const pct = alloc > 0 ? (used / alloc) * 100 : 0;
  const isFullyUsed = alloc - used <= 0;

  return (
    <div className={`py-3 ${isFullyUsed ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-base">{item.icon}</span>
        <span className="text-primary flex-1 text-sm font-medium">
          {isFa ? item.name_fa : item.name}
        </span>
        <div className="text-end">
          <span className="text-primary text-sm font-semibold">
            {isFa
              ? `${toPersianDigits(item.used_amount)} / ${toPersianDigits(item.allocated_amount)}`
              : `${item.used_amount} / ${item.allocated_amount}`}
          </span>
          <span className="text-tertiary text-xs">
            {" "}{isFa ? item.unit_name_fa : item.unit_name}
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--separator)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct >= 100 ? "rgb(156,163,175)" : pct >= 70 ? "rgb(234,179,8)" : "rgb(34,197,94)",
          }}
        />
      </div>
    </div>
  );
}

// --- Dev fallback data (all categories) ---

const DEV_ITEMS: ItemAllocationView[] = [
  // Food — national
  { item_id: 101, category: "food", name: "Rice", name_fa: "\u0628\u0631\u0646\u062C", icon: "\uD83C\uDF5A", scope: "national", unit_code: "kg", unit_name: "kg", unit_name_fa: "\u06A9\u06CC\u0644\u0648", allocated_amount: "5", used_amount: "2" },
  { item_id: 102, category: "food", name: "Cooking Oil", name_fa: "\u0631\u0648\u063A\u0646", icon: "\uD83E\uDED7", scope: "national", unit_code: "L", unit_name: "L", unit_name_fa: "\u0644\u06CC\u062A\u0631", allocated_amount: "2", used_amount: "0.5" },
  { item_id: 103, category: "food", name: "Sugar", name_fa: "\u0634\u06A9\u0631", icon: "\uD83E\uDDC2", scope: "national", unit_code: "kg", unit_name: "kg", unit_name_fa: "\u06A9\u06CC\u0644\u0648", allocated_amount: "1.5", used_amount: "0" },
  { item_id: 104, category: "food", name: "Salt", name_fa: "\u0646\u0645\u06A9", icon: "\uD83E\uDDC2", scope: "national", unit_code: "kg", unit_name: "kg", unit_name_fa: "\u06A9\u06CC\u0644\u0648", allocated_amount: "0.5", used_amount: "0" },
  { item_id: 105, category: "food", name: "Dried Beans", name_fa: "\u062D\u0628\u0648\u0628\u0627\u062A", icon: "\uD83E\uDED8", scope: "national", unit_code: "kg", unit_name: "kg", unit_name_fa: "\u06A9\u06CC\u0644\u0648", allocated_amount: "2", used_amount: "1" },
  { item_id: 106, category: "food", name: "Flour", name_fa: "\u0622\u0631\u062F", icon: "\uD83C\uDF3E", scope: "national", unit_code: "kg", unit_name: "kg", unit_name_fa: "\u06A9\u06CC\u0644\u0648", allocated_amount: "3", used_amount: "0" },
  { item_id: 107, category: "food", name: "Tea", name_fa: "\u0686\u0627\u06CC", icon: "\uD83C\uDF75", scope: "national", unit_code: "g", unit_name: "g", unit_name_fa: "\u06AF\u0631\u0645", allocated_amount: "200", used_amount: "100" },
  { item_id: 108, category: "food", name: "Canned Tuna", name_fa: "\u062A\u0646 \u0645\u0627\u0647\u06CC", icon: "\uD83D\uDC1F", scope: "national", unit_code: "cans", unit_name: "cans", unit_name_fa: "\u0642\u0648\u0637\u06CC", allocated_amount: "2", used_amount: "0" },
  { item_id: 109, category: "food", name: "Tomato Paste", name_fa: "\u0631\u0628 \u06AF\u0648\u062C\u0647", icon: "\uD83C\uDF45", scope: "national", unit_code: "g", unit_name: "g", unit_name_fa: "\u06AF\u0631\u0645", allocated_amount: "800", used_amount: "0" },
  { item_id: 110, category: "food", name: "Powdered Milk", name_fa: "\u0634\u06CC\u0631\u062E\u0634\u06A9", icon: "\uD83E\uDD5B", scope: "national", unit_code: "g", unit_name: "g", unit_name_fa: "\u06AF\u0631\u0645", allocated_amount: "400", used_amount: "200" },
  // Food — regional (tehran)
  { item_id: 201, category: "food", name: "Bread (Sangak)", name_fa: "\u0646\u0627\u0646 \u0633\u0646\u06AF\u06A9", icon: "\uD83C\uDF5E", scope: "regional", region: "tehran", unit_code: "loaves", unit_name: "loaves", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "5", used_amount: "3" },
  { item_id: 202, category: "food", name: "Eggs", name_fa: "\u062A\u062E\u0645\u200C\u0645\u0631\u063A", icon: "\uD83E\uDD5A", scope: "regional", region: "tehran", unit_code: "pcs", unit_name: "pcs", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "15", used_amount: "0" },
  { item_id: 211, category: "food", name: "Bread (Lavash)", name_fa: "\u0646\u0627\u0646 \u0644\u0648\u0627\u0634", icon: "\uD83C\uDF5E", scope: "regional", region: "urban", unit_code: "pcs", unit_name: "pcs", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "8", used_amount: "4" },
  { item_id: 212, category: "food", name: "Eggs", name_fa: "\u062A\u062E\u0645\u200C\u0645\u0631\u063A", icon: "\uD83E\uDD5A", scope: "regional", region: "urban", unit_code: "pcs", unit_name: "pcs", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "12", used_amount: "0" },
  { item_id: 221, category: "food", name: "Bread (Taftoon)", name_fa: "\u0646\u0627\u0646 \u062A\u0627\u0641\u062A\u0648\u0646", icon: "\uD83C\uDF5E", scope: "regional", region: "rural", unit_code: "pcs", unit_name: "pcs", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "10", used_amount: "5" },
  // Hygiene — national
  { item_id: 301, category: "hygiene", name: "Soap", name_fa: "\u0635\u0627\u0628\u0648\u0646", icon: "\uD83E\uDDFC", scope: "national", unit_code: "pcs", unit_name: "pcs", unit_name_fa: "\u0639\u062F\u062F", allocated_amount: "4", used_amount: "1" },
  { item_id: 302, category: "hygiene", name: "Shampoo", name_fa: "\u0634\u0627\u0645\u067E\u0648", icon: "\uD83E\uDDF4", scope: "national", unit_code: "bottles", unit_name: "bottles", unit_name_fa: "\u0628\u0637\u0631\u06CC", allocated_amount: "1", used_amount: "0" },
  { item_id: 303, category: "hygiene", name: "Toothpaste", name_fa: "\u062E\u0645\u06CC\u0631\u062F\u0646\u062F\u0627\u0646", icon: "\uD83E\uDEA5", scope: "national", unit_code: "packets", unit_name: "packets", unit_name_fa: "\u0628\u0633\u062A\u0647", allocated_amount: "1", used_amount: "0" },
  { item_id: 304, category: "hygiene", name: "Sanitary Pads", name_fa: "\u0646\u0648\u0627\u0631 \u0628\u0647\u062F\u0627\u0634\u062A\u06CC", icon: "\uD83E\uDE79", scope: "national", unit_code: "packets", unit_name: "packets", unit_name_fa: "\u0628\u0633\u062A\u0647", allocated_amount: "2", used_amount: "0" },
  // Medical — national
  { item_id: 401, category: "medical", name: "First Aid Kit", name_fa: "\u06A9\u06CC\u062A \u06A9\u0645\u06A9\u200C\u0647\u0627\u06CC \u0627\u0648\u0644\u06CC\u0647", icon: "\uD83E\uDE7A", scope: "national", unit_code: "kits", unit_name: "kits", unit_name_fa: "\u0628\u0633\u062A\u0647", allocated_amount: "1", used_amount: "0" },
  { item_id: 402, category: "medical", name: "Pain Relief", name_fa: "\u0645\u0633\u06A9\u0646", icon: "\uD83D\uDC8A", scope: "national", unit_code: "packets", unit_name: "packets", unit_name_fa: "\u0628\u0633\u062A\u0647", allocated_amount: "1", used_amount: "0" },
  { item_id: 403, category: "medical", name: "Bandages", name_fa: "\u0628\u0627\u0646\u062F \u0648 \u06AF\u0627\u0632", icon: "\uD83E\uDE79", scope: "national", unit_code: "packets", unit_name: "packets", unit_name_fa: "\u0628\u0633\u062A\u0647", allocated_amount: "2", used_amount: "0" },
];

// Category-specific header translation keys
const BASKET_HEADERS: Record<string, { title: string; regional: string }> = {
  food:    { title: "food.essentialBasket", regional: "food.regionalItems" },
  hygiene: { title: "catalog.hygieneBasket", regional: "catalog.hygieneRegional" },
  medical: { title: "catalog.medicalBasket", regional: "catalog.medicalRegional" },
};

export function FoodBasket({ category = "food" }: { category?: CouponCategory }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === "fa";
  const { household } = useHouseholdStore();
  const [showAll, setShowAll] = useState(false);
  const [national, setNational] = useState<ItemAllocationView[]>([]);
  const [regional, setRegional] = useState<ItemAllocationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const region = household?.location_segment || "urban";
  const headers = BASKET_HEADERS[category] || { title: "food.essentialBasket", regional: "food.regionalItems" };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Clear stale data from a previous category immediately
    setNational([]);
    setRegional([]);
    setShowAll(false);

    getItemAllocations(category)
      .then((res) => {
        if (cancelled) return;
        setNational(res.national ?? []);
        setRegional(res.regional ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        // Dev fallback: filter mock data by the requested category + region
        if (import.meta.env.DEV) {
          setNational(DEV_ITEMS.filter((i) => i.category === category && i.scope === "national"));
          setRegional(DEV_ITEMS.filter((i) => i.category === category && i.scope === "regional" && (!i.region || i.region === region)));
        } else {
          setError(true);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [region, category]);

  if (loading && national.length === 0) return null;
  if (error && national.length === 0) return null; // silently hide — category detail already shows balance

  const essentialsToShow = showAll ? national : national.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* National items */}
      {national.length > 0 && (
        <div className="glass glass-animate p-4" style={{ animationDelay: "200ms" }}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-primary font-semibold">
              {t(headers.title)}
            </h2>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ background: "rgba(34,197,94,0.15)", color: "rgb(34,197,94)" }}
            >
              {t("food.monthly")}
            </span>
          </div>
          <p className="text-tertiary mb-2 text-xs">
            {isFa
              ? "\u0633\u0647\u0645\u06CC\u0647 \u0647\u0631 \u0642\u0644\u0645 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u2014 \u062A\u0639\u06CC\u06CC\u0646\u200C\u0634\u062F\u0647 \u062A\u0648\u0633\u0637 \u0633\u062A\u0627\u062F \u0628\u062D\u0631\u0627\u0646"
              : "Each item has its own coupon \u2014 set by crisis admin"}
          </p>
          <div className="divide-y" style={{ borderColor: "var(--separator)" }}>
            {essentialsToShow.map((item) => (
              <ItemRow key={item.item_id} item={item} isFa={isFa} />
            ))}
          </div>
          {national.length > 5 && (
            <button
              className="mt-2 w-full py-1 text-center text-xs font-medium"
              style={{ color: "var(--accent)" }}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? t("food.showLess")
                : `${t("food.showAll")} (${national.length})`}
            </button>
          )}
        </div>
      )}

      {/* Regional items */}
      {regional.length > 0 && (
        <div className="glass glass-animate p-4" style={{ animationDelay: "250ms" }}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-primary font-semibold">
              {t(headers.regional)}
            </h2>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ background: "rgba(59,130,246,0.15)", color: "rgb(59,130,246)" }}
            >
              {isFa
                ? region === "tehran" ? "\u062A\u0647\u0631\u0627\u0646" : region === "rural" ? "\u0631\u0648\u0633\u062A\u0627\u06CC\u06CC" : "\u0634\u0647\u0631\u06CC"
                : region === "tehran" ? "Tehran" : region === "rural" ? "Rural" : "Urban"}
            </span>
          </div>
          <p className="text-tertiary mb-2 text-xs">
            {isFa
              ? "\u0627\u0642\u0644\u0627\u0645 \u0648\u06CC\u0698\u0647 \u0645\u0646\u0637\u0642\u0647 \u0634\u0645\u0627 \u2014 \u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u0648\u0633\u0637 \u0633\u062A\u0627\u062F \u0628\u062D\u0631\u0627\u0646 \u0645\u0646\u0637\u0642\u0647"
              : "Items for your region \u2014 managed by regional crisis admin"}
          </p>
          <div className="divide-y" style={{ borderColor: "var(--separator)" }}>
            {regional.map((item) => (
              <ItemRow key={item.item_id} item={item} isFa={isFa} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
