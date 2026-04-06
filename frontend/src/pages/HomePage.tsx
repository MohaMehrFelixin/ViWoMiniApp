import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { useBalanceStore } from "../store/useBalanceStore";
import { CategoryCard } from "../components/CategoryCard";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { IconEmpty } from "../components/Icons";
import { NoticeBanner } from "../components/NoticeBanner";
import { getWeekNumber } from "../lib/utils";
import { promptAddToHomeScreen, showSettingsButton, hideSettingsButton, getTelegramUser } from "../lib/telegram";

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { household, fetchHousehold, loading: hhLoading } = useHouseholdStore();
  const tgUser = getTelegramUser();
  const {
    balances,
    loading: balLoading,
    error,
    fetchBalances,
    lastFetched,
  } = useBalanceStore();

  useEffect(() => {
    fetchHousehold();
    // Prompt add-to-home-screen only once per install
    const prompted = sessionStorage.getItem("viwo-hs-prompted");
    if (!prompted) {
      promptAddToHomeScreen();
      sessionStorage.setItem("viwo-hs-prompted", "1");
    }
  }, [fetchHousehold]);

  useEffect(() => {
    if (household) {
      fetchBalances();
    }
  }, [household, fetchBalances]);

  // Show Telegram Settings button → navigates to Profile
  useEffect(() => {
    showSettingsButton(() => navigate("/profile"));
    return () => hideSettingsButton();
  }, [navigate]);

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
          <h1 className="text-primary text-lg font-bold">
            {tgUser?.firstName ? `${tgUser.firstName}, ` : ""}{t("home.title")}
          </h1>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = "https://t.me/ViWoMiniBot/viwoapp";
              const text = i18n.language === "fa"
                ? "سامانه کوپن دیجیتال ویوو — توزیع عادلانه کالاهای ضروری"
                : "ViWo Digital Coupon — Fair distribution of essential supplies";
              window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
            }}
            className="glass-btn glass-btn-sm"
            aria-label="Share"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
          <button
            onClick={toggleLang}
            className="glass-btn glass-btn-sm"
            aria-label={i18n.language === "fa" ? "تغییر زبان" : "Toggle language"}
          >
            {i18n.language === "fa" ? "EN" : "\u0641\u0627"}
          </button>
        </div>
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
