import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { useBalanceStore } from "../store/useBalanceStore";
import { generateQR, redeemCoupon } from "../api/coupon";
import { extractErrorMessage } from "../lib/api-error";
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
  distribution_point_id: number;
}

type Step = "scanning" | "review" | "processing" | "success" | "insufficient" | "error";

const MAX_QR_LENGTH = 2048;

const VALID_CATEGORIES = ["water", "food", "fuel", "hygiene", "medical", "energy"];

function isValidProviderQR(data: unknown): data is ProviderQRData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.provider_id === "string" &&
    typeof d.provider_name === "string" &&
    typeof d.category === "string" &&
    VALID_CATEGORIES.includes(d.category as string) &&
    typeof d.amount === "string" &&
    typeof d.distribution_point_id === "number"
  );
}

export function ScannerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isFa = i18n.language === "fa";

  const [step, setStep] = useState<Step>("scanning");
  const [qrData, setQrData] = useState<ProviderQRData | null>(null);
  const [txCode, setTxCode] = useState("");
  const [txTime, setTxTime] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const confirmingRef = useRef(false);
  const cachedQRRef = useRef<{ qrData: string; category: CouponCategory; amount: string } | null>(null);
  const scannerContainerId = "qr-reader";

  const { balances, fetchBalances } = useBalanceStore();

  // Fetch balances on mount and when stale (>30s)
  useEffect(() => {
    const STALE_MS = 30_000;
    const { lastFetched } = useBalanceStore.getState();
    if (balances.length === 0 || !lastFetched || Date.now() - lastFetched > STALE_MS) {
      fetchBalances();
    }
  }, [balances.length, fetchBalances]);

  const checkBalance = (category: CouponCategory, amount: string): { hasBalance: boolean; available: string } => {
    const balance = balances.find((b) => b.category === category);
    if (!balance) return { hasBalance: false, available: "0" };
    const requested = Number(amount);
    if (!Number.isFinite(requested) || requested <= 0) return { hasBalance: false, available: balance.available_now };
    const available = Number(balance.available_now);
    // Integer comparison to avoid floating point issues (multiply by 100)
    const hasBalance = Math.round(available * 100) >= Math.round(requested * 100);
    return { hasBalance, available: balance.available_now };
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */) {
          await scannerRef.current.stop();
        }
      } catch {
        // already stopped
      }
      scannerRef.current = null;
    }
  }, []);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (decodedText.length > MAX_QR_LENGTH) {
      setErrorMsg(t("scanner.invalidQR"));
      setStep("error");
      return;
    }
    try {
      const parsed = JSON.parse(decodedText);
      if (!isValidProviderQR(parsed)) {
        setErrorMsg(t("scanner.invalidQR"));
        setStep("error");
        return;
      }
      // Validate amount is positive
      const amount = Number(parsed.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setErrorMsg(t("scanner.invalidQR"));
        setStep("error");
        return;
      }
      setQrData(parsed);
      // Refresh balances before showing review
      fetchBalances();
      setStep("review");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setErrorMsg(t("scanner.invalidQR"));
      setStep("error");
    }
  }, [t, fetchBalances]);

  // Start camera scanner
  useEffect(() => {
    if (step !== "scanning") return;

    let cancelled = false;
    const scanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!cancelled) {
            scanner.stop().catch(() => {});
            onScanSuccess(decodedText);
          }
        },
        () => {} // ignore scan errors (no QR found yet)
      )
      .catch(() => {
        if (!cancelled) {
          setErrorMsg(t("scanner.cameraError"));
          setStep("error");
        }
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [step, onScanSuccess, stopScanner, t]);

  const handleConfirm = async () => {
    if (!qrData || confirmingRef.current) return;
    confirmingRef.current = true;

    const { hasBalance } = checkBalance(qrData.category, qrData.amount);
    if (!hasBalance) {
      setStep("insufficient");
      confirmingRef.current = false;
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      return;
    }
    setStep("processing");
    try {
      // Reuse cached QR if it matches (retry after partial failure)
      let qrDataStr: string;
      if (
        cachedQRRef.current &&
        cachedQRRef.current.category === qrData.category &&
        cachedQRRef.current.amount === qrData.amount
      ) {
        qrDataStr = cachedQRRef.current.qrData;
      } else {
        const qrResponse = await generateQR({
          category: qrData.category,
          amount: qrData.amount,
        });
        qrDataStr = qrResponse.qr_data;
        cachedQRRef.current = {
          qrData: qrDataStr,
          category: qrData.category,
          amount: qrData.amount,
        };
      }

      const redemption = await redeemCoupon(qrDataStr, qrData.distribution_point_id);
      cachedQRRef.current = null;
      setTxCode(redemption.coupon_code);
      setTxTime(redemption.created_at);
      setStep("success");
      fetchBalances();
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      // Do NOT clear cachedQRRef — allows retry with same QR on next confirm
      const msg = await extractErrorMessage(err, t("common.error"));
      setErrorMsg(msg);
      setStep("error");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      confirmingRef.current = false;
    }
  };

  const handleRetry = () => {
    setErrorMsg("");
    confirmingRef.current = false;
    fetchBalances();
    setStep("review");
  };

  const handleReset = () => {
    setStep("scanning");
    setQrData(null);
    setTxCode("");
    setTxTime("");
    setErrorMsg("");
    confirmingRef.current = false;
    cachedQRRef.current = null;
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
            id={scannerContainerId}
            className="relative overflow-hidden rounded-[22px]"
            style={{ width: 288, height: 288, background: "#0a0a0a" }}
          />
        </div>

        <p className="text-tertiary mt-4 text-xs">
          {t("scanner.pointCamera")}
        </p>
      </div>
    );
  }

  // ---- ERROR ----
  if (step === "error") {
    const canRetry = qrData !== null;
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
            <h2 className="text-primary text-xl font-bold">{t("common.error")}</h2>
            <p className="text-secondary mt-2 text-sm">{errorMsg}</p>
          </div>
          {canRetry ? (
            <div className="flex w-full gap-3">
              <button className="glass-btn flex-1" onClick={handleReset}>
                {t("scanner.scanAgain")}
              </button>
              <button className="glass-btn glass-btn-primary flex-1" onClick={handleRetry}>
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <button className="glass-btn w-full" onClick={handleReset}>
              {t("scanner.scanAgain")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- REVIEW ----
  if (step === "review" && qrData && catMeta) {
    const { hasBalance, available } = checkBalance(qrData.category, qrData.amount);

    return (
      <div className="space-y-4 p-4">
        <h1 className="text-primary text-xl font-bold">
          {t("scanner.reviewTitle")}
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
            <span className="text-secondary text-sm">{t("scanner.provider")}</span>
            <span className="text-primary text-sm font-medium">{isFa ? qrData.provider_name_fa : qrData.provider_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary text-sm">{t("scanner.type")}</span>
            <span className="text-primary text-sm">{isFa ? qrData.provider_type_fa : qrData.provider_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary text-sm">{t("scanner.address")}</span>
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
              {t("scanner.couponBalance")}
            </p>
            <p className="text-secondary text-xs">
              {t("scanner.available")}: {formatAmount(available, i18n.language)} {t(catMeta.unitKey)}
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
              ? t("scanner.sufficient")
              : t("scanner.insufficient")
            }
          </span>
        </div>

        {/* Warning */}
        {hasBalance && (
          <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "rgba(234,179,8,0.1)" }}>
            <IconWarning size={16} color="rgb(234,179,8)" />
            <p className="text-xs" style={{ color: "rgb(234,179,8)" }}>
              {t("scanner.deductionWarning")}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button className="glass-btn flex-1" onClick={handleReset}>
            {t("scanner.cancel")}
          </button>
          <button
            className="glass-btn glass-btn-primary flex-1"
            onClick={handleConfirm}
            disabled={!hasBalance || step !== "review"}
          >
            {hasBalance
              ? t("scanner.confirm")
              : t("scanner.insufficient")
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
              {t("scanner.processing")}
            </p>
            <p className="text-secondary mt-1 text-sm">
              {t("scanner.pleaseWait")}
            </p>
          </div>
          <button
            className="glass-btn glass-btn-sm mt-2"
            onClick={() => {
              confirmingRef.current = false;
              setErrorMsg(t("scanner.cancel"));
              setStep("error");
            }}
          >
            {t("scanner.cancel")}
          </button>
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
              {t("scanner.insufficientBalance")}
            </h2>
            <p className="text-secondary mt-2 text-sm">
              {t("scanner.insufficientDesc", {
                available: formatAmount(available, i18n.language),
                unit: t(catMeta.unitKey),
                category: t(`category.${qrData.category}`),
                requested: qrData.amount,
              })}
            </p>
          </div>
          <div className="flex w-full gap-3">
            <button className="glass-btn flex-1" onClick={handleReset}>
              {t("scanner.scanAgain")}
            </button>
            <button className="glass-btn glass-btn-primary flex-1" onClick={() => navigate("/")}>
              {t("scanner.viewCoupons")}
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
              {t("scanner.successTitle")}
            </h2>
            <p className="text-secondary mt-2 text-sm">
              {t("scanner.successDesc", {
                amount: qrData.amount,
                unit: t(catMeta.unitKey),
                category: t(`category.${qrData.category}`),
              })}
            </p>
          </div>

          {/* Receipt */}
          <div className="glass-subtle w-full space-y-2 rounded-2xl p-4 text-start">
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{t("scanner.transaction")}</span>
              <span className="text-primary font-mono text-xs font-bold">{txCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{t("scanner.items")}</span>
              <span className="text-primary text-xs">{isFa ? qrData.item_description_fa : qrData.item_description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{t("scanner.provider")}</span>
              <span className="text-primary text-xs">{isFa ? qrData.provider_name_fa : qrData.provider_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary text-xs">{t("scanner.time")}</span>
              <span className="text-primary text-xs">
                {txTime
                  ? new Date(txTime).toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })
                  : new Date().toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })
                }
              </span>
            </div>
          </div>

          <div className="flex w-full gap-3">
            <button className="glass-btn flex-1" onClick={handleReset}>
              {t("scanner.scanAgain")}
            </button>
            <button className="glass-btn glass-btn-primary flex-1" onClick={() => navigate("/profile/history")}>
              {t("scanner.history")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback — inconsistent state, offer recovery
  return (
    <div className="flex flex-col items-center justify-center p-6" style={{ minHeight: "calc(100vh - 100px)" }}>
      <button className="glass-btn" onClick={handleReset}>
        {t("scanner.scanAgain")}
      </button>
    </div>
  );
}
