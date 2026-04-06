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
      className={`glass glass-interactive glass-shimmer glass-animate glass-tint-${balance.category} flex aspect-square w-full flex-col justify-between p-3.5 text-start`}
      aria-label={t(`category.${balance.category}`)}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: `${meta.color}20`,
            boxShadow: `0 0 12px ${meta.color}18`,
            color: meta.color,
          }}
        >
          {CatIcon && <CatIcon size={20} />}
        </div>
        <span className="text-tertiary text-[10px]">
          {t("home.week", { n: balance.current_week })}
        </span>
      </div>

      <div>
        <div className="text-primary text-sm font-semibold">
          {t(`category.${balance.category}`)}
        </div>
        <div className="mt-1 text-lg font-bold leading-tight" style={{ color: meta.color }}>
          {formatAmount(balance.available_now, locale)}
        </div>
        <div className="text-tertiary text-[10px]">{t("home.available")}</div>
      </div>

      <div>
        <ProgressBar percent={percent} color={meta.color} />
        <div className="mt-1 flex justify-between text-[10px]">
          <span className="text-secondary">{formatAmount(balance.used_amount, locale)}</span>
          <span className="text-secondary">{formatAmount(balance.total_amount, locale)}</span>
        </div>
      </div>
    </button>
  );
}
