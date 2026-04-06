import type { CouponCategory } from "./types";

export interface CategoryMeta {
  key: CouponCategory;
  color: string;
  bgLight: string;
  unit: string;
  unitKey: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: "water", color: "#3B82F6", bgLight: "rgba(59,130,246,0.12)", unit: "L", unitKey: "units.liters" },
  { key: "food", color: "#22C55E", bgLight: "rgba(34,197,94,0.12)", unit: "kg", unitKey: "units.kg" },
  { key: "fuel", color: "#F97316", bgLight: "rgba(249,115,22,0.12)", unit: "", unitKey: "units.cylinders" },
  { key: "hygiene", color: "#A855F7", bgLight: "rgba(168,85,247,0.12)", unit: "", unitKey: "units.items" },
  { key: "medical", color: "#EF4444", bgLight: "rgba(239,68,68,0.12)", unit: "", unitKey: "units.kits" },
  { key: "energy", color: "#EAB308", bgLight: "rgba(234,179,8,0.12)", unit: "", unitKey: "units.items" },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<CouponCategory, CategoryMeta>;

export const API_BASE = "/api/v1/coupon";

export const WEEKLY_SCHEDULE = [35, 25, 25, 15] as const;
