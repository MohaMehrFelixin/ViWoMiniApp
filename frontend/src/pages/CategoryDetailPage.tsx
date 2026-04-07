import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CategoryBalance, CouponCategory } from "../lib/types";
import { CATEGORY_MAP, WEEKLY_SCHEDULE } from "../lib/constants";
import { CATEGORY_ICONS } from "../components/Icons";
import { formatAmount, calcUsagePercent } from "../lib/utils";
import { getCategoryBalance, generateQR } from "../api/coupon";
import { extractErrorMessage } from "../lib/api-error";
import { ProgressBar } from "../components/ProgressBar";
import { PowerBankCard } from "../components/PowerBankCard";
import { FoodBasket } from "../components/FoodBasket";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

export function CategoryDetailPage() {
  const { category } = useParams<{ category: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<CategoryBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const generatingRef = useRef(false);
  const meta = CATEGORY_MAP[category as CouponCategory];
  const CatIcon = CATEGORY_ICONS[category as string];
  const locale = i18n.language;

  useEffect(() => {
    if (!category || !meta) return;
    setLoading(true);
    getCategoryBalance(category as CouponCategory)
      .then(setBalance)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, meta]);

  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton;
    back?.show();
    const handler = () => navigate(-1);
    back?.onClick(handler);
    return () => {
      back?.offClick(handler);
      back?.hide();
    };
  }, [navigate]);

  if (!meta) return <ErrorState message="Invalid category" />;
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); getCategoryBalance(category as CouponCategory).then(setBalance).catch((e) => setError(e instanceof Error ? e.message : "Error")).finally(() => setLoading(false)); }} />;
  if (!balance) return <ErrorState message="No allocation found" />;

  const percent = calcUsagePercent(balance.used_amount, balance.total_amount);

  return (
    <div className="space-y-4 p-4">
      <div className={`glass glass-animate glass-tint-${balance.category} space-y-5 p-5`}>
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: `${meta.color}20`,
              boxShadow: `0 0 24px ${meta.color}20`,
              color: meta.color,
            }}
          >
            {CatIcon && <CatIcon size={28} />}
          </div>
          <div>
            <h1 className="text-primary text-xl font-bold">
              {t(`category.${balance.category}`)}
            </h1>
            <span className="text-secondary text-sm">
              {t("home.week", { n: balance.current_week })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("home.total"), value: balance.total_amount },
            { label: t("home.used"), value: balance.used_amount },
            { label: t("home.available"), value: balance.available_now, highlight: true },
          ].map((stat) => (
            <div key={stat.label} className="glass-subtle rounded-2xl p-3 text-center">
              <div className="text-tertiary text-xs">{stat.label}</div>
              <div
                className="mt-1 text-lg font-bold"
                style={stat.highlight ? { color: meta.color } : undefined}
              >
                {formatAmount(stat.value, locale)}
              </div>
            </div>
          ))}
        </div>

        <ProgressBar percent={percent} color={meta.color} height={10} />
      </div>

      <div className="glass glass-animate p-4" style={{ animationDelay: "100ms" }}>
        <h2 className="text-primary mb-3 font-semibold">
          {t("category.weeklySchedule")}
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {WEEKLY_SCHEDULE.map((pct, i) => {
            const isActive = i + 1 === balance.current_week;
            return (
              <div
                key={i}
                className={`rounded-2xl p-3 text-center transition-all ${
                  isActive ? "glass-prominent" : "glass-subtle opacity-60"
                }`}
                style={
                  isActive
                    ? { boxShadow: `0 0 20px ${meta.color}25`, borderColor: `${meta.color}40` }
                    : undefined
                }
              >
                <div className="text-tertiary text-xs">
                  {t("home.week", { n: i + 1 })}
                </div>
                <div className={`text-lg font-bold ${isActive ? "" : "text-secondary"}`}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate QR button */}
      <button
        className="glass-btn glass-btn-primary glass-btn-lg w-full glass-animate"
        style={{ animationDelay: "200ms" }}
        disabled={generating || parseFloat(balance.available_now) <= 0}
        onClick={async () => {
          if (generatingRef.current) return;
          generatingRef.current = true;
          setGenerating(true);
          setGenError(null);
          try {
            const qrData = await generateQR({
              category: category as CouponCategory,
              amount: balance.available_now,
            });
            navigate("/qr", { state: { qrData, category } });
          } catch (err) {
            const msg = await extractErrorMessage(err, t("common.error"));
            setGenError(msg);
          } finally {
            setGenerating(false);
            generatingRef.current = false;
          }
        }}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {t("common.loading")}
          </span>
        ) : (
          t("category.generateQR")
        )}
      </button>
      {genError && (
        <div className="glass-subtle rounded-2xl p-3 text-center text-sm" style={{ color: "var(--cat-medical)" }}>
          {genError}
        </div>
      )}

      {(category === "food" || category === "hygiene" || category === "medical") && (
        <FoodBasket category={category as CouponCategory} />
      )}
      {category === "energy" && <PowerBankCard />}
    </div>
  );
}
