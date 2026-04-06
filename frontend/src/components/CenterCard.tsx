import { useTranslation } from "react-i18next";
import type { DistributionCenter } from "../lib/types";
import { CENTER_TYPE_ICONS } from "./Icons";

interface CenterCardProps {
  center: DistributionCenter;
}

const STATUS_STYLE: Record<string, { color: string; key: string }> = {
  open: { color: "var(--cat-food)", key: "map.open" },
  closed: { color: "var(--cat-medical)", key: "map.closed" },
  low_stock: { color: "var(--cat-fuel)", key: "map.lowStock" },
  out_of_stock: { color: "var(--cat-medical)", key: "map.outOfStock" },
};

export function CenterCard({ center }: CenterCardProps) {
  const { t } = useTranslation();
  const status = STATUS_STYLE[center.status] ?? STATUS_STYLE["closed"]!;
  const TypeIcon = CENTER_TYPE_ICONS[center.type] ?? CENTER_TYPE_ICONS["government"]!;

  return (
    <div className="glass glass-animate flex items-start gap-3 p-4">
      <div className="text-secondary">
        <TypeIcon size={24} />
      </div>
      <div className="flex-1">
        <div className="text-primary font-medium">{center.name}</div>
        <div className="text-tertiary mt-0.5 text-xs leading-relaxed">
          {center.address.slice(0, 80)}
        </div>
        {center.queue_minutes > 0 && (
          <div className="text-secondary mt-1 text-xs">
            {t("map.waitTime")}: {center.queue_minutes} {t("map.minutes")}
          </div>
        )}
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-xs font-medium"
        style={{
          background: `${status.color}18`,
          color: status.color,
          border: `1px solid ${status.color}30`,
        }}
      >
        {t(status.key)}
      </span>
    </div>
  );
}
