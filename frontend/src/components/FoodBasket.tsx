import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHouseholdStore } from "../store/useHouseholdStore";

interface FoodItem {
  id: string;
  name: string;
  nameFa: string;
  allocated: string;
  allocatedFa: string;
  used: string;
  usedFa: string;
  unit: string;
  unitFa: string;
  icon: string;
}

// Essential items — fixed nationwide, each with its own coupon allocation
const ESSENTIAL_ITEMS: FoodItem[] = [
  { id: "e1", name: "Rice", nameFa: "برنج", allocated: "5", allocatedFa: "۵", used: "2", usedFa: "۲", unit: "kg", unitFa: "کیلو", icon: "🍚" },
  { id: "e2", name: "Cooking Oil", nameFa: "روغن", allocated: "2", allocatedFa: "۲", used: "0.5", usedFa: "۰/۵", unit: "L", unitFa: "لیتر", icon: "🫗" },
  { id: "e3", name: "Sugar", nameFa: "شکر", allocated: "1.5", allocatedFa: "۱/۵", used: "0", usedFa: "۰", unit: "kg", unitFa: "کیلو", icon: "🧂" },
  { id: "e4", name: "Salt", nameFa: "نمک", allocated: "0.5", allocatedFa: "۰/۵", used: "0", usedFa: "۰", unit: "kg", unitFa: "کیلو", icon: "🧂" },
  { id: "e5", name: "Dried Beans", nameFa: "حبوبات", allocated: "2", allocatedFa: "۲", used: "1", usedFa: "۱", unit: "kg", unitFa: "کیلو", icon: "🫘" },
  { id: "e6", name: "Flour", nameFa: "آرد", allocated: "3", allocatedFa: "۳", used: "0", usedFa: "۰", unit: "kg", unitFa: "کیلو", icon: "🌾" },
  { id: "e7", name: "Tea", nameFa: "چای", allocated: "200", allocatedFa: "۲۰۰", used: "100", usedFa: "۱۰۰", unit: "g", unitFa: "گرم", icon: "🍵" },
  { id: "e8", name: "Canned Tuna", nameFa: "تن ماهی", allocated: "2", allocatedFa: "۲", used: "0", usedFa: "۰", unit: "cans", unitFa: "قوطی", icon: "🐟" },
  { id: "e9", name: "Tomato Paste", nameFa: "رب گوجه", allocated: "800", allocatedFa: "۸۰۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🍅" },
  { id: "e10", name: "Powdered Milk", nameFa: "شیرخشک", allocated: "400", allocatedFa: "۴۰۰", used: "200", usedFa: "۲۰۰", unit: "g", unitFa: "گرم", icon: "🥛" },
];

// Regional items — set by admin per region, each with its own coupon
const REGIONAL_ITEMS: Record<string, FoodItem[]> = {
  tehran: [
    { id: "r1", name: "Bread (Sangak)", nameFa: "نان سنگک", allocated: "5", allocatedFa: "۵", used: "3", usedFa: "۳", unit: "loaves", unitFa: "عدد", icon: "🍞" },
    { id: "r2", name: "Eggs", nameFa: "تخم‌مرغ", allocated: "15", allocatedFa: "۱۵", used: "0", usedFa: "۰", unit: "pcs", unitFa: "عدد", icon: "🥚" },
    { id: "r3", name: "Chicken", nameFa: "مرغ", allocated: "1", allocatedFa: "۱", used: "0", usedFa: "۰", unit: "kg", unitFa: "کیلو", icon: "🍗" },
    { id: "r4", name: "Pasta", nameFa: "ماکارونی", allocated: "1", allocatedFa: "۱", used: "0.5", usedFa: "۰/۵", unit: "kg", unitFa: "کیلو", icon: "🍝" },
    { id: "r5", name: "Dates", nameFa: "خرما", allocated: "500", allocatedFa: "۵۰۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🌴" },
  ],
  urban: [
    { id: "r1", name: "Bread (Lavash)", nameFa: "نان لواش", allocated: "8", allocatedFa: "۸", used: "4", usedFa: "۴", unit: "pcs", unitFa: "عدد", icon: "🍞" },
    { id: "r2", name: "Eggs", nameFa: "تخم‌مرغ", allocated: "12", allocatedFa: "۱۲", used: "0", usedFa: "۰", unit: "pcs", unitFa: "عدد", icon: "🥚" },
    { id: "r3", name: "Cheese", nameFa: "پنیر", allocated: "400", allocatedFa: "۴۰۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🧀" },
    { id: "r4", name: "Halva", nameFa: "حلوا", allocated: "300", allocatedFa: "۳۰۰", used: "150", usedFa: "۱۵۰", unit: "g", unitFa: "گرم", icon: "🍯" },
  ],
  rural: [
    { id: "r1", name: "Bread (Taftoon)", nameFa: "نان تافتون", allocated: "10", allocatedFa: "۱۰", used: "5", usedFa: "۵", unit: "pcs", unitFa: "عدد", icon: "🍞" },
    { id: "r2", name: "Eggs", nameFa: "تخم‌مرغ", allocated: "20", allocatedFa: "۲۰", used: "0", usedFa: "۰", unit: "pcs", unitFa: "عدد", icon: "🥚" },
    { id: "r3", name: "Dried Whey (Kashk)", nameFa: "کشک", allocated: "500", allocatedFa: "۵۰۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🥣" },
    { id: "r4", name: "Ghee", nameFa: "روغن حیوانی", allocated: "500", allocatedFa: "۵۰۰", used: "250", usedFa: "۲۵۰", unit: "g", unitFa: "گرم", icon: "🧈" },
    { id: "r5", name: "Dried Fruits", nameFa: "خشکبار", allocated: "300", allocatedFa: "۳۰۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🥜" },
    { id: "r6", name: "Honey", nameFa: "عسل", allocated: "250", allocatedFa: "۲۵۰", used: "0", usedFa: "۰", unit: "g", unitFa: "گرم", icon: "🍯" },
  ],
};

function ItemRow({ item, isFa }: { item: FoodItem; isFa: boolean }) {
  const alloc = parseFloat(item.allocated);
  const used = parseFloat(item.used);
  const remaining = alloc - used;
  const pct = alloc > 0 ? (used / alloc) * 100 : 0;
  const isFullyUsed = remaining <= 0;

  return (
    <div className={`py-3 ${isFullyUsed ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-base">{item.icon}</span>
        <span className="text-primary flex-1 text-sm font-medium">
          {isFa ? item.nameFa : item.name}
        </span>
        <div className="text-end">
          <span className="text-primary text-sm font-semibold">
            {isFa
              ? `${item.usedFa} / ${item.allocatedFa}`
              : `${item.used} / ${item.allocated}`}
          </span>
          <span className="text-tertiary text-xs"> {isFa ? item.unitFa : item.unit}</span>
        </div>
      </div>
      {/* Mini progress bar */}
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

export function FoodBasket() {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === "fa";
  const { household } = useHouseholdStore();
  const [showAll, setShowAll] = useState(false);

  const region = household?.location_segment || "urban";
  const regionalItems = REGIONAL_ITEMS[region] || REGIONAL_ITEMS.urban;
  const essentialsToShow = showAll ? ESSENTIAL_ITEMS : ESSENTIAL_ITEMS.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Essential food basket */}
      <div className="glass glass-animate p-4" style={{ animationDelay: "200ms" }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-primary font-semibold">
            {t("food.essentialBasket")}
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
            ? "سهمیه هر قلم جداگانه — تعیین‌شده توسط ستاد بحران"
            : "Each item has its own coupon — set by crisis admin"}
        </p>
        <div className="divide-y" style={{ borderColor: "var(--separator)" }}>
          {essentialsToShow.map((item) => (
            <ItemRow key={item.id} item={item} isFa={isFa} />
          ))}
        </div>
        {ESSENTIAL_ITEMS.length > 5 && (
          <button
            className="mt-2 w-full py-1 text-center text-xs font-medium"
            style={{ color: "var(--accent)" }}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? t("food.showLess")
              : `${t("food.showAll")} (${ESSENTIAL_ITEMS.length})`}
          </button>
        )}
      </div>

      {/* Regional items */}
      <div className="glass glass-animate p-4" style={{ animationDelay: "250ms" }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-primary font-semibold">
            {t("food.regionalItems")}
          </h2>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{ background: "rgba(59,130,246,0.15)", color: "rgb(59,130,246)" }}
          >
            {isFa
              ? region === "tehran" ? "تهران" : region === "rural" ? "روستایی" : "شهری"
              : region === "tehran" ? "Tehran" : region === "rural" ? "Rural" : "Urban"}
          </span>
        </div>
        <p className="text-tertiary mb-2 text-xs">
          {isFa
            ? "اقلام ویژه منطقه شما — مدیریت توسط ستاد بحران منطقه"
            : "Items for your region — managed by regional crisis admin"}
        </p>
        <div className="divide-y" style={{ borderColor: "var(--separator)" }}>
          {regionalItems?.map((item) => (
            <ItemRow key={item.id} item={item} isFa={isFa} />
          ))}
        </div>
      </div>
    </div>
  );
}
