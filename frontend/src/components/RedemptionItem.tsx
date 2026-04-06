import { useTranslation } from "react-i18next";
import type { CouponRedemption } from "../lib/types";
import { CATEGORY_MAP } from "../lib/constants";
import { CATEGORY_ICONS } from "./Icons";
import { formatAmount, formatDate } from "../lib/utils";

interface RedemptionItemProps {
  redemption: CouponRedemption;
  onDispute?: (id: number) => void;
}

export function RedemptionItem({ redemption, onDispute }: RedemptionItemProps) {
  const { t, i18n } = useTranslation();
  const meta = CATEGORY_MAP[redemption.category];
  const CatIcon = CATEGORY_ICONS[redemption.category];

  return (
    <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
      <div style={{ color: meta?.color }}>
        {CatIcon ? <CatIcon size={20} /> : null}
      </div>
      <div className="flex-1">
        <div className="text-primary text-sm font-medium">
          {t(`category.${redemption.category}`)}
        </div>
        <div className="text-tertiary text-xs">
          {formatDate(redemption.created_at, i18n.language)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold" style={{ color: meta?.color }}>
          {formatAmount(redemption.amount, i18n.language)}
        </span>
        {redemption.status === "completed" && onDispute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDispute(redemption.id);
            }}
            className="glass-btn glass-btn-sm text-xs"
            aria-label={t("history.dispute")}
          >
            {t("history.dispute")}
          </button>
        )}
        {redemption.status === "disputed" && (
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--cat-medical)",
            }}
          >
            {t("history.disputed")}
          </span>
        )}
      </div>
    </div>
  );
}
