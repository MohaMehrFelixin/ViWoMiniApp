import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBalanceStore } from "../store/useBalanceStore";
import { IconCheck, IconWarning, CATEGORY_ICONS } from "../components/Icons";
import { CATEGORIES } from "../lib/constants";
import { formatAmount } from "../lib/utils";
import type { CouponCategory } from "../lib/types";

// The provider's QR code contains all this info
interface ProviderQRData {
  provider_id: string;
  provider_name: string;
  provider_name_fa: string;
  provider_type: string;
  provider_type_fa: string;
  provider_address: string;
  provider_address_fa: string;
  category: CouponCategory;
  amount: string;
  item_description: string;
  item_description_fa: string;
}

// Mock QR payloads that simulate what a provider's app would generate
const MOCK_QR_PAYLOADS: ProviderQRData[] = [
  {
    provider_id: "p-001",
    provider_name: "Shahrvand Supermarket",
    provider_name_fa: "فروشگاه شهروند",
    provider_type: "Grocery Store",
    provider_type_fa: "سوپرمارکت",
    provider_address: "Vali-Asr Ave, Tehran",
    provider_address_fa: "خیابان ولی‌عصر، تهران",
    category: "food",
    amount: "5",
    item_description: "5 kg Rice + 2 L Oil",
    item_description_fa: "۵ کیلو برنج + ۲ لیتر روغن",
  },
  {
    provider_id: "p-002",
    provider_name: "Darou Pakhsh Pharmacy",
    provider_name_fa: "داروخانه دارو پخش",
    provider_type: "Pharmacy",
    provider_type_fa: "داروخانه",
    provider_address: "Enghelab St, Tehran",
    provider_address_fa: "خیابان انقلاب، تهران",
    category: "medical",
    amount: "1",
    item_description: "1 First-Aid Kit",
    item_description_fa: "۱ بسته کمک‌های اولیه",
  },
  {
    provider_id: "p-003",
    provider_name: "National Fuel Station #14",
    provider_name_fa: "جایگاه سوخت ملی شماره ۱۴",
    provider_type: "Fuel Station",
    provider_type_fa: "جایگاه سوخت",
    provider_address: "Azadi Blvd, Tehran",
    provider_address_fa: "بلوار آزادی، تهران",
    category: "fuel",
    amount: "0.5",
    item_description: "0.5 Gas Cylinder",
    item_description_fa: "نصف کپسول گاز",
  },
  {
    provider_id: "p-004",
    provider_name: "Water Distribution Point #7",
    provider_name_fa: "نقطه توزیع آب شماره ۷",
    provider_type: "Government Center",
    provider_type_fa: "مرکز دولتی",
    provider_address: "Sadeghiyeh, Tehran",
    provider_address_fa: "صادقیه، تهران",
    category: "water",
    amount: "20",
    item_description: "20 L Drinking Water",
    item_description_fa: "۲۰ لیتر آب آشامیدنی",
  },
  {
    provider_id: "p-005",
    provider_name: "Behdasht Store",
    provider_name_fa: "فروشگاه بهداشت",
    provider_type: "Hygiene Store",
    provider_type_fa: "فروشگاه بهداشتی",
    provider_address: "Tajrish, Tehran",
    provider_address_fa: "تجریش، تهران",
    category: "hygiene",
    amount: "3",
    item_description: "3 Soap Bars + Shampoo",
    item_description_fa: "۳ عدد صابون + شامپو",
  },
];

type Step = "scanning" | "review" | "processing" | "success" | "insufficient";

export function ScannerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isFa = i18n.language === "fa";

  const [step, setStep] = useState<Step>("scanning");
  const [qrData, setQrData] = useState<ProviderQRData | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [txCode, setTxCode] = useState("");
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { balances, fetchBalances } = useBalanceStore();

  // Fetch balances on mount if not loaded
  useEffect(() => {
    if (balances.length === 0) fetchBalances();
  }, [balances.length, fetchBalances]);

  // Check if user has enough balance for the scanned category
  const checkBalance = (category: CouponCategory, amount: string): { hasBalance: boolean; available: string } => {
    const balance = balances.find((b) => b.category === category);
    if (!balance) return { hasBalance: false, available: "0" };
    const available = parseFloat(balance.available_now);
    return { hasBalance: available >= parseFloat(amount), available: balance.available_now };
  };

  // Scanning animation
  useEffect(() => {
    if (step !== "scanning") return;
    setScanProgress(0);
    scanTimer.current = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(scanTimer.current!);
          // Pick a random mock QR
          const payload = MOCK_QR_PAYLOADS[Math.floor(Math.random() * MOCK_QR_PAYLOADS.length)];
          setQrData(payload);
          setStep("review");
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
          return 100;
        }
        return prev + 2;
      });
    }, 60);
    return () => { if (scanTimer.current) clearInterval(scanTimer.current); };
  }, [step]);

  const handleConfirm = () => {
    if (!qrData) return;
    const { hasBalance } = checkBalance(qrData.category, qrData.amount);
    if (!hasBalance) {
      setStep("insufficient");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      return;
    }
    setStep("processing");
    // Simulate API call
    setTimeout(() => {
      setTxCode(`VC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
      setStep("success");
      fetchBalances(); // refresh balances after redemption
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    }, 2000);
  };

  const handleReset = () => {
    setStep("scanning");
    setQrData(null);
    setTxCode("");
  };

  const catMeta = qrData ? CATEGORIES.find((c) => c.key === qrData.category) : null;
  const CatIcon = qrData ? CATEGORY_ICONS[qrData.category] : null;

  // ---- SCANNING ----
  if (step === "scanning") {
    return (
      <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
        <h1 className="text-primary mb-2 text-xl font-bold">{t("scanner.title")}</h1>
        <p className="text-secondary mb-6 text-center text-sm">{t("scanner.instruction")}</p>

        <div className="glass glass-prominent overflow-hidden rounded-3xl p-1">
          <div
            className="relative flex h-72 w-72 items-center justify-center overflow-hidden rounded-[22px]"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)" }}
          >
            <div
              className="absolute inset-x-6 h-0.5 rounded-full"
              style={{
                top: `${scanProgress}%`,
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.8), transparent)",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
                transition: "top 60ms linear",
              }}
            />
            <svg className="absolute inset-4" viewBox="0 0 100 100" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2">
              <path d="M0,20 L0,0 L20,0" />
              <path d="M80,0 L100,0 L100,20" />
              <path d="M100,80 L100,100 L80,100" />
              <path d="M20,100 L0,100 L0,80" />
            </svg>
            <div style={{ opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="7" width="4" height="4" rx="0.5" />
                <rect x="13" y="7" width="4" height="4" rx="0.5" />
                <rect x="7" y="13" width="4" height="4" rx="0.5" />
              </svg>
            </div>
          </div>
        </div>

        <p className="text-tertiary mt-4 text-xs">
          {isFa ? `در حال اسکن... ${Math.min(scanProgress, 99)}٪` : `Scanning... ${Math.min(scanProgress, 99)}%`}
        </p>
      </div>
    );
  }

  // ---- REVIEW (provider set the amount & product, user just confirms) ----
  if (step === "review" && qrData && catMeta) {
    const { hasBalance, available } = checkBalance(qrData.category, qrData.amount);

    return (
      <div className="space-y-4 p-4">
        <h1 className="text-primary text-xl font-bold">
          {isFa ? "بررسی دریافت" : "Review Redemption"}
        </h1>

        {/* What you're getting */}
        <div className="glass glass-animate p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${catMeta.color}20` }}>
              {CatIcon && <CatIcon size={28} color={catMeta.color} />}
            </div>
            <div className="flex-1">
              <p className="text-primary text-lg font-bold">
                {qrData.amount} {t(catMeta.unitKey)}
              </p>
              <p className="text-secondary text-sm">{t(`category.${qrData.category}`)}</p>
            </div>
          </div>

          {/* Item description */}
          <div className="mt-4 rounded-xl p-3" style={{ background: `${catMeta.color}10` }}>
            <p className="text-sm font-medium" style={{ color: catMeta.color }}>
              {isFa ? qrData.item_description_fa : qrData.item_description}
            </p>
          </div>
        </div>

        {/* Provider info */}
        <div className="glass glass-animate space-y-2 p-4" style={{ animationDelay: "50ms" }}>
          <div className="flex justify-between">
            <span className="text-secondary text-sm">{isFa ? "ارائه‌دهنده" : "Provider"}</span>
            <span className="text-primary text-sm font-medium">{isFa ? qrData.provider_name_fa : qrData.provider_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary text-sm">{isFa ? "نوع" : "Type"}</span>
            <span className="text-primary text-sm">{isFa ? qrData.provider_type_fa : qrData.provider_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary text-sm">{isFa ? "آدرس" : "Address"}</span>
            <span className="text-primary text-end text-sm" style={{ maxWidth: "60%" }}>{isFa ? qrData.provider_address_fa : qrData.provider_address}</span>
          </div>
        </div>

        {/* Balance check */}
        <div
          className="glass glass-animate flex items-center gap-3 p-4"
          style={{ animationDelay: "100ms" }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: hasBalance ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}
          >
            {hasBalance
              ? <IconCheck size={18} color="rgb(34,197,94)" />
              : <IconWarning size={18} color="rgb(239,68,68)" />
            }
          </div>
          <div className="flex-1">
            <p className="text-primary text-sm font-medium">
              {isFa ? "موجودی سهمیه" : "Coupon Balance"}
            </p>
            <p className="text-secondary text-xs">
              {isFa ? "موجود" : "Available"}: {formatAmount(available, i18n.language)} {t(catMeta.unitKey)}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: hasBalance ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: hasBalance ? "rgb(34,197,94)" : "rgb(239,68,68)",
            }}
          >
            {hasBalance
              ? (isFa ? "کافی" : "Sufficient")
              : (isFa ? "ناکافی" : "Insufficient")
            }
          </span>
        </div>

        {/* Warning */}
        {hasBalance && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(234,179,8,0.1)" }}>
            <IconWarning size={16} color="rgb(234,179,8)" />
            <p className="text-xs" style={{ color: "rgb(234,179,8)" }}>
              {isFa
                ? "پس از تأیید، این مقدار از سهمیه شما کسر خواهد شد."
                : "After confirmation, this amount will be deducted from your coupon balance."}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button className="glass-btn flex-1" onClick={handleReset}>
            {isFa ? "لغو" : "Cancel"}
          </button>
          <button
            className="glass-btn glass-btn-primary flex-1"
            onClick={handleConfirm}
            disabled={!hasBalance}
          >
            {hasBalance
              ? (isFa ? "تأیید دریافت" : "Confirm")
              : (isFa ? "موجودی ناکافی" : "Insufficient")
            }
          </button>
        </div>
      </div>
    );
  }

  // ---- PROCESSING ----
  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
        <div className="glass glass-prominent flex flex-col items-center gap-5 p-8 text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-white/10" style={{ borderTopColor: "var(--accent)" }} />
          <div>
            <p className="text-primary text-lg font-semibold">
              {isFa ? "در حال پردازش..." : "Processing..."}
            </p>
            <p className="text-secondary mt-1 text-sm">
              {isFa ? "لطفاً صبر کنید" : "Please wait"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- INSUFFICIENT BALANCE ----
  if (step === "insufficient" && qrData && catMeta) {
    const { available } = checkBalance(qrData.category, qrData.amount);
    return (
      <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
        <div className="glass glass-prominent glass-animate flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "rgba(239,68,68,0.15)", boxShadow: "0 0 40px rgba(239,68,68,0.15)" }}
          >
            <IconWarning size={40} color="rgb(239,68,68)" />
          </div>
          <div>
            <h2 className="text-primary text-xl font-bold">
              {isFa ? "موجودی ناکافی" : "Insufficient Balance"}
            </h2>
            <p className="text-secondary mt-2 text-sm">
              {isFa
                ? `شما ${formatAmount(available, "fa")} ${t(catMeta.unitKey)} ${t(`category.${qrData.category}`)} دارید، اما ${qrData.amount} ${t(catMeta.unitKey)} درخواست شده است.`
                : `You have ${formatAmount(available, "en")} ${t(catMeta.unitKey)} of ${t(`category.${qrData.category}`)}, but ${qrData.amount} ${t(catMeta.unitKey)} was requested.`}
            </p>
          </div>
          <div className="flex w-full gap-3">
            <button className="glass-btn flex-1" onClick={handleReset}>
              {isFa ? "اسکن مجدد" : "Scan Again"}
            </button>
            <button className="glass-btn glass-btn-primary flex-1" onClick={() => navigate("/")}>
              {isFa ? "مشاهده سهمیه" : "View Coupons"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- SUCCESS ----
  if (step === "success" && qrData && catMeta) {
    return (
      <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
        <div className="glass glass-prominent glass-animate flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "rgba(34,197,94,0.15)", boxShadow: "0 0 40px rgba(34,197,94,0.2)" }}
          >
            <IconCheck size={40} color="rgb(34,197,94)" />
          </div>

          <div>
            <h2 className="text-primary text-xl font-bold">
              {isFa ? "دریافت موفق" : "Redemption Successful"}
            </h2>
            <p className="text-secondary mt-2 text-sm">
              {isFa
                ? `${qrData.amount} ${t(catMeta.unitKey)} ${t(`category.${qrData.category}`)} دریافت شد.`
                : `${qrData.amount} ${t(catMeta.unitKey)} of ${t(`category.${qrData.category}`)} redeemed.`}
            </p>
          </div>

          {/* Receipt */}
          <div className="glass-subtle w-full space-y-2 rounded-2xl p-4 text-start">
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{isFa ? "کد تراکنش" : "Transaction"}</span>
              <span className="text-primary font-mono text-xs font-bold">{txCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{isFa ? "اقلام" : "Items"}</span>
              <span className="text-primary text-xs">{isFa ? qrData.item_description_fa : qrData.item_description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{isFa ? "ارائه‌دهنده" : "Provider"}</span>
              <span className="text-primary text-xs">{isFa ? qrData.provider_name_fa : qrData.provider_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{isFa ? "زمان" : "Time"}</span>
              <span className="text-primary text-xs">
                {new Date().toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="flex w-full gap-3">
            <button className="glass-btn flex-1" onClick={handleReset}>
              {isFa ? "اسکن جدید" : "Scan Again"}
            </button>
            <button className="glass-btn glass-btn-primary flex-1" onClick={() => navigate("/profile/history")}>
              {isFa ? "تاریخچه" : "History"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
