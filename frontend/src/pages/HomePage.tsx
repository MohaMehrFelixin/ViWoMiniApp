import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { useBalanceStore } from "../store/useBalanceStore";
import { CategoryCard } from "../components/CategoryCard";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { IconEmpty } from "../components/Icons";
import { NoticeBanner } from "../components/NoticeBanner";
import { getWeekNumber } from "../lib/utils";

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { household, fetchHousehold, loading: hhLoading } = useHouseholdStore();
  const {
    balances,
    loading: balLoading,
    error,
    fetchBalances,
    lastFetched,
  } = useBalanceStore();

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  useEffect(() => {
    if (household) {
      fetchBalances();
    }
  }, [household, fetchBalances]);

  const loading = hhLoading || balLoading;

  if (loading && balances.length === 0) return <Loading />;
  if (error && balances.length === 0)
    return <ErrorState message={error} onRetry={() => { fetchHousehold(); fetchBalances(); }} />;

  if (balances.length === 0) {
    return (
      <EmptyState icon={<IconEmpty size={48} />} title={t("home.noAllocations")} />
    );
  }

  const toggleLang = () => {
    const next = i18n.language === "fa" ? "en" : "fa";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  return (
    <div className="space-y-4 p-4">
      <NoticeBanner />

      <div className="glass glass-animate flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="ViWo" className="h-10 w-10 rounded-xl" />
          <div>
          <h1 className="text-primary text-lg font-bold">{t("home.title")}</h1>
          <span className="text-tertiary text-xs">
            {t("home.week", { n: getWeekNumber() })}
            {lastFetched && (
              <span>
                {" \u00B7 "}
                {new Date(lastFetched).toLocaleTimeString(
                  i18n.language === "fa" ? "fa-IR" : "en-US",
                  { hour: "2-digit", minute: "2-digit" }
                )}
              </span>
            )}
          </span>
          </div>
        </div>
        <button
          onClick={toggleLang}
          className="glass-btn glass-btn-sm"
          aria-label={i18n.language === "fa" ? "تغییر زبان" : "Toggle language"}
        >
          {i18n.language === "fa" ? "EN" : "\u0641\u0627"}
        </button>
      </div>

      <div className="glass-stagger grid grid-cols-2 gap-3">
        {Object.values(
          balances.reduce<Record<string, typeof balances[0]>>((acc, b) => {
            if (!acc[b.category]) acc[b.category] = b;
            return acc;
          }, {})
        ).map((b) => (
          <CategoryCard key={b.category} balance={b} />
        ))}
      </div>
    </div>
  );
}
