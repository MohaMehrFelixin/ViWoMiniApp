import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CategoryBalance } from "../lib/types";
import { CATEGORY_MAP } from "../lib/constants";
import { CATEGORY_ICONS } from "./Icons";
import { formatAmount, calcUsagePercent } from "../lib/utils";
import { ProgressBar } from "./ProgressBar";

interface CategoryCardProps {
  balance: CategoryBalance;
}

export function CategoryCard({ balance }: CategoryCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const meta = CATEGORY_MAP[balance.category];
  const CatIcon = CATEGORY_ICONS[balance.category];

  if (!meta) return null;

  const percent = calcUsagePercent(balance.used_amount, balance.total_amount);
  const locale = i18n.language;

  return (
    <button
      onClick={() => {
        navigate(`/category/${balance.category}`);
        window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
      }}
      className={`glass glass-interactive glass-shimmer glass-animate glass-tint-${balance.category} flex w-full flex-col gap-3 p-4 text-start`}
      aria-label={t(`category.${balance.category}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              background: `${meta.color}20`,
              boxShadow: `0 0 16px ${meta.color}22`,
              color: meta.color,
            }}
          >
            {CatIcon && <CatIcon size={22} />}
          </div>
          <div>
            <div className="text-primary font-semibold">
              {t(`category.${balance.category}`)}
            </div>
            <div className="text-tertiary text-xs">
              {t("home.week", { n: balance.current_week })}
            </div>
          </div>
        </div>
        <div className="text-end">
          <div className="text-xl font-bold" style={{ color: meta.color }}>
            {formatAmount(balance.available_now, locale)}
          </div>
          <div className="text-tertiary text-xs">{t("home.available")}</div>
        </div>
      </div>

      <ProgressBar percent={percent} color={meta.color} />

      <div className="flex justify-between text-xs">
        <span className="text-secondary">
          {t("home.used")}: {formatAmount(balance.used_amount, locale)}
        </span>
        <span className="text-secondary">
          {t("home.total")}: {formatAmount(balance.total_amount, locale)}
        </span>
      </div>
    </button>
  );
}
