import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { useProviderStore } from "../store/useProviderStore";
import { CATEGORY_MAP } from "../lib/constants";
import { CATEGORY_ICONS, IconStore, IconCheck, IconWarning, IconWater, IconFood } from "../components/Icons";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { formatAmount, toPersianDigits } from "../lib/utils";
import { getCatalogItems } from "../api/coupon";
import type { CouponCategory, ProviderProfile, CatalogItemWithUnit } from "../lib/types";

// --- Store Status Card ---

function StoreStatusCard() {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === "fa";
  const { stats, openSession, closeSession } = useProviderStore();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actingRef = useRef(false);

  const session = stats?.current_session ?? null;
  const isOpen = session !== null;

  // Live elapsed timer
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!session) { setElapsed(""); return; }
    const calc = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(session.opened_at).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const raw = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      setElapsed(isFa ? toPersianDigits(raw) : raw);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [session, isFa]);

  const handleToggle = async () => {
    if (actingRef.current) return;
    actingRef.current = true;
    setActing(true);
    setError(null);
    try {
      if (isOpen) {
        await closeSession();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning");
      } else {
        await openSession();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setActing(false);
      actingRef.current = false;
    }
  };

  return (
    <div className="glass glass-animate p-5">
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: isOpen ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.15)",
            boxShadow: isOpen ? "0 0 24px rgba(34,197,94,0.2)" : "none",
          }}
        >
          <IconStore size={28} color={isOpen ? "rgb(34,197,94)" : "rgb(156,163,175)"} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: isOpen ? "rgb(34,197,94)" : "rgb(156,163,175)" }}
            />
            <span className="text-primary text-base font-bold">
              {isOpen ? t("provider.storeOpen") : t("provider.storeClosed")}
            </span>
          </div>
          {isOpen && elapsed && (
            <p className="text-secondary mt-0.5 font-mono text-sm">{elapsed}</p>
          )}
        </div>
        <button
          className={`glass-btn ${isOpen ? "" : "glass-btn-primary"}`}
          onClick={handleToggle}
          disabled={acting}
          style={isOpen ? { color: "rgb(239,68,68)", borderColor: "rgba(239,68,68,0.3)" } : undefined}
        >
          {acting
            ? "..."
            : isOpen
              ? t("provider.closeStore")
              : t("provider.openStore")
          }
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-xl p-2 text-center text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
          {error}
        </div>
      )}
    </div>
  );
}

// --- Dev fallback catalog items ---
const DEV_CATALOG: CatalogItemWithUnit[] = [
  { id: 101, category: "food", name: "Rice", name_fa: "\u0628\u0631\u0646\u062C", icon: "\uD83C\uDF5A", scope: "national", default_amount: "5", sort_order: 1, is_active: true, unit: { code: "kg", name: "kg", name_fa: "\u06A9\u06CC\u0644\u0648" } },
  { id: 102, category: "food", name: "Cooking Oil", name_fa: "\u0631\u0648\u063A\u0646", icon: "\uD83E\uDED7", scope: "national", default_amount: "2", sort_order: 2, is_active: true, unit: { code: "L", name: "L", name_fa: "\u0644\u06CC\u062A\u0631" } },
  { id: 103, category: "food", name: "Sugar", name_fa: "\u0634\u06A9\u0631", icon: "\uD83E\uDDC2", scope: "national", default_amount: "1.5", sort_order: 3, is_active: true, unit: { code: "kg", name: "kg", name_fa: "\u06A9\u06CC\u0644\u0648" } },
  { id: 105, category: "food", name: "Dried Beans", name_fa: "\u062D\u0628\u0648\u0628\u0627\u062A", icon: "\uD83E\uDED8", scope: "national", default_amount: "2", sort_order: 5, is_active: true, unit: { code: "kg", name: "kg", name_fa: "\u06A9\u06CC\u0644\u0648" } },
  { id: 106, category: "food", name: "Flour", name_fa: "\u0622\u0631\u062F", icon: "\uD83C\uDF3E", scope: "national", default_amount: "3", sort_order: 6, is_active: true, unit: { code: "kg", name: "kg", name_fa: "\u06A9\u06CC\u0644\u0648" } },
  { id: 107, category: "food", name: "Tea", name_fa: "\u0686\u0627\u06CC", icon: "\uD83C\uDF75", scope: "national", default_amount: "200", sort_order: 7, is_active: true, unit: { code: "g", name: "g", name_fa: "\u06AF\u0631\u0645" } },
  { id: 108, category: "food", name: "Canned Tuna", name_fa: "\u062A\u0646 \u0645\u0627\u0647\u06CC", icon: "\uD83D\uDC1F", scope: "national", default_amount: "2", sort_order: 8, is_active: true, unit: { code: "cans", name: "cans", name_fa: "\u0642\u0648\u0637\u06CC" } },
  { id: 201, category: "food", name: "Bread (Sangak)", name_fa: "\u0646\u0627\u0646 \u0633\u0646\u06AF\u06A9", icon: "\uD83C\uDF5E", scope: "regional", region: "tehran", default_amount: "5", sort_order: 20, is_active: true, unit: { code: "loaves", name: "loaves", name_fa: "\u0639\u062F\u062F" } },
  { id: 202, category: "food", name: "Eggs", name_fa: "\u062A\u062E\u0645\u200C\u0645\u0631\u063A", icon: "\uD83E\uDD5A", scope: "regional", region: "tehran", default_amount: "15", sort_order: 21, is_active: true, unit: { code: "pcs", name: "pcs", name_fa: "\u0639\u062F\u062F" } },
  // Water items
  { id: 501, category: "water", name: "Drinking Water (Bottle)", name_fa: "\u0622\u0628 \u0622\u0634\u0627\u0645\u06CC\u062F\u0646\u06CC (\u0628\u0637\u0631\u06CC)", icon: "\uD83D\uDCA7", scope: "national", default_amount: "6", sort_order: 1, is_active: true, unit: { code: "L", name: "L", name_fa: "\u0644\u06CC\u062A\u0631" } },
  { id: 502, category: "water", name: "Water Tank Refill", name_fa: "\u067E\u0631 \u06A9\u0631\u062F\u0646 \u0645\u062E\u0632\u0646 \u0622\u0628", icon: "\uD83D\uDEB0", scope: "national", default_amount: "100", sort_order: 2, is_active: true, unit: { code: "L", name: "L", name_fa: "\u0644\u06CC\u062A\u0631" } },
  { id: 503, category: "water", name: "Water Purification Tablets", name_fa: "\u0642\u0631\u0635 \u062A\u0635\u0641\u06CC\u0647 \u0622\u0628", icon: "\uD83E\uDDEA", scope: "national", default_amount: "10", sort_order: 3, is_active: true, unit: { code: "pcs", name: "pcs", name_fa: "\u0639\u062F\u062F" } },
];

// --- QR Generator ---

// Allowed categories for this provider (admin-defined; water+food for now)
const PROVIDER_CATEGORIES: { key: CouponCategory; Icon: typeof IconWater }[] = [
  { key: "water", Icon: IconWater },
  { key: "food", Icon: IconFood },
];

function QRGenerator({ profile, isStoreOpen }: { profile: ProviderProfile; isStoreOpen: boolean }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === "fa";

  const [category, setCategory] = useState<CouponCategory>("food");
  const [items, setItems] = useState<CatalogItemWithUnit[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItemWithUnit | null>(null);
  const [amount, setAmount] = useState("");
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);

  // Fetch catalog items for the selected category
  useEffect(() => {
    let cancelled = false;
    setLoadingItems(true);
    setItems([]);
    setSelectedItem(null);
    setAmount("");

    getCatalogItems(category)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          setItems(DEV_CATALOG.filter((i) => i.category === category));
        }
      })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [category]);

  const normalizeAmount = (raw: string) => {
    return raw
      .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/[^\d.]/g, "");
  };

  const parsedAmount = Number(normalizeAmount(amount));
  const canGenerate = selectedItem !== null && amount.length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const selectItem = (item: CatalogItemWithUnit) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      setAmount("");
    } else {
      setSelectedItem(item);
      setAmount(item.default_amount);
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    }
  };

  const adjustAmount = (delta: number) => {
    const current = parsedAmount || 0;
    const next = Math.max(0, current + delta);
    if (next > 0) setAmount(String(next));
  };

  const handleGenerate = () => {
    if (!selectedItem || !canGenerate) return;
    const normalizedAmount = normalizeAmount(amount);
    const qrData = {
      provider_id: String(profile.id),
      provider_name: profile.name,
      provider_name_fa: profile.name_fa,
      provider_type: profile.type === "distributor" ? "distributor" : profile.service_type,
      provider_type_fa: profile.type === "distributor"
        ? "\u062A\u0648\u0632\u06CC\u0639\u200C\u06A9\u0646\u0646\u062F\u0647"
        : (t(`provider.serviceType_${profile.service_type}`) || profile.service_type),
      provider_address: profile.store_address,
      provider_address_fa: profile.store_address_fa,
      category: selectedItem.category,
      amount: normalizedAmount,
      item_description: selectedItem.name,
      item_description_fa: selectedItem.name_fa,
      distribution_point_id: profile.distribution_point_id,
    };
    setQrValue(JSON.stringify(qrData));
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  };

  const handleNewQR = () => {
    setQrValue(null);
    setSelectedItem(null);
    setAmount("");
  };

  const catMeta = CATEGORY_MAP[selectedItem?.category ?? category];

  // ── QR DISPLAY ──
  if (qrValue && selectedItem && catMeta) {
    return (
      <div className="glass glass-prominent glass-animate p-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="text-primary text-lg font-bold">
            {t("provider.showToCustomer")}
          </h2>

          <div
            className="glass-subtle overflow-hidden rounded-3xl p-5"
            style={{ background: "rgba(255,255,255,0.95)" }}
          >
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="M"
              includeMargin={false}
              fgColor="#1a1a1a"
              bgColor="transparent"
            />
          </div>

          {/* Item badge */}
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2" style={{ background: `${catMeta.color}12` }}>
            <span className="text-xl">{selectedItem.icon}</span>
            <div className="text-start">
              <div className="text-sm font-bold" style={{ color: catMeta.color }}>
                {formatAmount(normalizeAmount(amount), i18n.language)} {isFa ? selectedItem.unit.name_fa : selectedItem.unit.name}
              </div>
              <div className="text-secondary text-xs">
                {isFa ? selectedItem.name_fa : selectedItem.name}
              </div>
            </div>
          </div>

          <button className="glass-btn glass-btn-primary glass-btn-lg w-full" onClick={handleNewQR}>
            {t("provider.newQR")}
          </button>
        </div>
      </div>
    );
  }

  // ── FORM ──
  return (
    <div className="glass glass-animate space-y-4 p-5" style={{ animationDelay: "50ms" }}>
      <h2 className="text-primary font-bold">{t("provider.generateQR")}</h2>

      {/* Category tabs */}
      <div className="flex gap-2">
        {PROVIDER_CATEGORIES.map((cat) => {
          const meta = CATEGORY_MAP[cat.key];
          const isActive = category === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setCategory(cat.key);
                window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
              }}
              className="glass-btn flex flex-1 items-center justify-center gap-2 py-3"
              style={isActive
                ? { background: `${meta.color}18`, borderColor: `${meta.color}50`, color: meta.color }
                : undefined
              }
            >
              <cat.Icon size={18} color={isActive ? meta.color : undefined} />
              <span className="text-sm font-semibold">{t(`category.${cat.key}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Items list */}
      {loadingItems ? (
        <div className="flex justify-center py-6">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/10" style={{ borderTopColor: "var(--accent)" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-subtle rounded-2xl p-4 text-center">
          <p className="text-tertiary text-sm">{t("provider.noItems")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const meta = CATEGORY_MAP[item.category as CouponCategory];
            return (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start transition-all active:scale-[0.98]"
                style={{
                  background: isSelected ? `${meta?.color ?? "var(--accent)"}15` : "var(--separator)",
                  border: isSelected ? `1.5px solid ${meta?.color ?? "var(--accent)"}50` : "1.5px solid transparent",
                }}
              >
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="text-primary text-sm font-medium">
                    {isFa ? item.name_fa : item.name}
                  </div>
                  <div className="text-tertiary text-[10px]">
                    {item.default_amount} {isFa ? item.unit.name_fa : item.unit.name}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: meta?.color ?? "var(--accent)" }}>
                    <IconCheck size={14} color="#fff" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Amount editor — only when an item is selected */}
      {selectedItem && (
        <div className="glass-subtle rounded-2xl p-4">
          <div className="text-tertiary mb-2 text-xs font-medium">
            {t("provider.amount")}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustAmount(-1)}
              disabled={parsedAmount <= 1}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-bold active:scale-90"
              style={{ background: "var(--separator)", color: "var(--text-1)" }}
            >
              −
            </button>
            <div className="relative flex-1">
              <input
                className="glass-input text-center text-xl font-bold font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                dir="ltr"
                aria-label={t("provider.enterAmount")}
              />
              <span className="text-tertiary pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs">
                {isFa ? selectedItem.unit.name_fa : selectedItem.unit.name}
              </span>
            </div>
            <button
              onClick={() => adjustAmount(1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-bold active:scale-90"
              style={{ background: "var(--separator)", color: "var(--text-1)" }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Store closed warning */}
      {!isStoreOpen && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(234,179,8,0.1)" }}>
          <IconWarning size={16} color="rgb(234,179,8)" />
          <p className="text-xs" style={{ color: "rgb(234,179,8)" }}>
            {t("provider.storeClosedWarning")}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        className="glass-btn glass-btn-primary glass-btn-lg w-full"
        onClick={handleGenerate}
        disabled={!canGenerate || !isStoreOpen}
      >
        {selectedItem
          ? `${t("provider.generate")} — ${isFa ? selectedItem.name_fa : selectedItem.name}`
          : t("provider.selectItem")
        }
      </button>
    </div>
  );
}

// --- Stats Card ---

function StatsCard() {
  const { t, i18n } = useTranslation();
  const { stats } = useProviderStore();

  if (!stats) return null;

  return (
    <div className="space-y-3">
      {/* Today */}
      <div className="glass glass-animate p-4" style={{ animationDelay: "100ms" }}>
        <h3 className="text-primary mb-3 font-semibold">{t("provider.todayStats")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-subtle rounded-2xl p-3 text-center">
            <div className="text-tertiary text-xs">{t("provider.transactions")}</div>
            <div className="text-primary mt-1 text-xl font-bold">
              {formatAmount(stats.today.transactions, i18n.language)}
            </div>
          </div>
          <div className="glass-subtle rounded-2xl p-3 text-center">
            <div className="text-tertiary text-xs">{t("provider.categories")}</div>
            <div className="text-primary mt-1 text-xl font-bold">
              {formatAmount(stats.today.by_category.length, i18n.language)}
            </div>
          </div>
        </div>

        {stats.today.by_category.length > 0 && (
          <div className="mt-3 space-y-2">
            {stats.today.by_category.map((cs) => {
              const meta = CATEGORY_MAP[cs.category];
              const CatIcon = CATEGORY_ICONS[cs.category];
              if (!meta) return null;
              return (
                <div key={cs.category} className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${meta.color}15` }}
                  >
                    {CatIcon && <CatIcon size={16} color={meta.color} />}
                  </div>
                  <span className="text-primary flex-1 text-sm">{t(`category.${cs.category}`)}</span>
                  <span className="text-secondary text-sm font-medium">
                    {formatAmount(cs.total_amount, i18n.language)} {t(meta.unitKey)}
                  </span>
                  <span className="text-tertiary text-xs">
                    ({formatAmount(cs.count, i18n.language)})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Summary */}
      <div className="glass glass-animate p-4" style={{ animationDelay: "150ms" }}>
        <h3 className="text-primary mb-3 font-semibold">{t("provider.workSummary")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-subtle rounded-2xl p-3 text-center">
            <div className="text-tertiary text-xs">{t("provider.daysWorked")}</div>
            <div className="text-primary mt-1 text-xl font-bold">
              {formatAmount(stats.total.days_worked, i18n.language)}
            </div>
          </div>
          <div className="glass-subtle rounded-2xl p-3 text-center">
            <div className="text-tertiary text-xs">{t("provider.totalHours")}</div>
            <div className="text-primary mt-1 text-xl font-bold">
              {formatAmount(stats.total.total_hours, i18n.language)}
            </div>
          </div>
        </div>

        {/* All-time category breakdown */}
        {stats.total.by_category.length > 0 && (
          <div className="mt-3">
            <p className="text-tertiary mb-2 text-xs">{t("provider.totalDistributed")}</p>
            <div className="space-y-1.5">
              {stats.total.by_category.map((cs) => {
                const meta = CATEGORY_MAP[cs.category];
                const CatIcon = CATEGORY_ICONS[cs.category];
                if (!meta) return null;
                return (
                  <div key={cs.category} className="flex items-center gap-2">
                    {CatIcon && <CatIcon size={14} color={meta.color} />}
                    <span className="text-secondary flex-1 text-xs">{t(`category.${cs.category}`)}</span>
                    <span className="text-primary text-xs font-medium">
                      {formatAmount(cs.total_amount, i18n.language)} {t(meta.unitKey)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Provider Page ---

export function ProviderPage() {
  const { t } = useTranslation();
  const { profile, stats, loading, error, fetchProfile, fetchStats } = useProviderStore();

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [fetchProfile, fetchStats]);

  if (loading && !profile) return <Loading />;
  if (error && !profile) {
    return <ErrorState message={error} onRetry={() => { fetchProfile(); fetchStats(); }} />;
  }

  // Not yet approved
  if (!profile || profile.status !== "approved") {
    const statusKey = profile?.status ?? "pending";
    return (
      <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
        <div className="glass glass-prominent glass-animate flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: statusKey === "rejected"
                ? "rgba(239,68,68,0.15)"
                : "rgba(234,179,8,0.15)",
            }}
          >
            {statusKey === "rejected"
              ? <IconWarning size={40} color="rgb(239,68,68)" />
              : <IconStore size={40} color="rgb(234,179,8)" />
            }
          </div>
          <div>
            <h1 className="text-primary text-xl font-bold">
              {t("provider.title")}
            </h1>
            <p className="text-secondary mt-2 text-sm">
              {statusKey === "rejected"
                ? t("provider.rejected")
                : t("provider.pendingApproval")
              }
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: statusKey === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
              color: statusKey === "rejected" ? "rgb(239,68,68)" : "rgb(234,179,8)",
            }}
          >
            {t(`distributor.status_${statusKey}`)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="glass glass-animate flex items-center gap-3 p-4">
        <IconStore size={20} color="var(--accent)" />
        <div className="flex-1">
          <h1 className="text-primary text-lg font-bold">{t("provider.title")}</h1>
          <p className="text-tertiary text-xs">
            {profile.type === "distributor"
              ? t("provider.distributorRole")
              : t("provider.serviceRole")
            }
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(34,197,94,0.15)", color: "rgb(34,197,94)" }}
        >
          {t("distributor.status_approved")}
        </span>
      </div>

      <StoreStatusCard />
      <QRGenerator profile={profile} isStoreOpen={stats?.current_session !== null && stats?.current_session !== undefined} />
      <StatsCard />
    </div>
  );
}
