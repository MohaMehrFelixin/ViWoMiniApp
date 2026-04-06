import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import type { GenerateQRResponse, CouponCategory } from "../lib/types";
import { CATEGORY_MAP } from "../lib/constants";
import { CATEGORY_ICONS } from "../components/Icons";
import { formatAmount } from "../lib/utils";
import { CountdownTimer } from "../components/CountdownTimer";
import { lockPortrait, unlockOrientation } from "../lib/telegram";

interface QRLocationState {
  qrData: GenerateQRResponse;
  category: CouponCategory;
}

export function QRDisplayPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [expired, setExpired] = useState(false);
  const state = location.state as QRLocationState | undefined;

  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton;
    back?.show();
    const handler = () => navigate(-1);
    back?.onClick(handler);
    lockPortrait(); // Prevent rotation while QR is displayed
    return () => {
      back?.offClick(handler);
      back?.hide();
      unlockOrientation();
    };
  }, [navigate]);

  if (!state?.qrData) {
    navigate("/", { replace: true });
    return null;
  }

  const { qrData, category } = state;
  const meta = CATEGORY_MAP[category];
  const CatIcon = CATEGORY_ICONS[category];
  const payload = qrData.payload;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6 p-6">
      <div
        className={`glass glass-prominent glass-animate glass-tint-${category} flex w-full max-w-sm flex-col items-center space-y-5 p-6`}
      >
        <div className="flex items-center gap-2" style={{ color: meta?.color }}>
          {CatIcon && <CatIcon size={24} />}
          <h1 className="text-primary text-xl font-bold">
            {t(`category.${category}`)}
          </h1>
        </div>

        <div
          className={`glass-subtle overflow-hidden rounded-3xl p-5 transition-all duration-500 ${
            expired ? "opacity-25 grayscale" : ""
          }`}
          style={{ background: "rgba(255,255,255,0.95)" }}
        >
          <QRCodeSVG
            value={qrData.qr_data}
            size={200}
            level="M"
            includeMargin={false}
            fgColor="#1a1a1a"
            bgColor="transparent"
          />
        </div>

        <CountdownTimer
          expiresAt={payload.expires_at}
          onExpired={() => {
            setExpired(true);
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning");
          }}
        />

        <div className="text-center">
          <span className="text-tertiary text-xs">{t("qr.amount")}</span>
          <div className="text-4xl font-bold" style={{ color: meta?.color }}>
            {formatAmount(payload.amount, i18n.language)}
          </div>
        </div>

        <div className="glass-subtle w-full rounded-2xl px-4 py-2 text-center">
          <span className="text-tertiary text-xs">{t("qr.couponCode")}</span>
          <div className="text-primary mt-0.5 font-mono text-sm font-semibold tracking-wide">
            {payload.coupon_code}
          </div>
        </div>

        <p className="text-secondary text-center text-sm">{t("qr.scanToPay")}</p>
      </div>

      {expired && (
        <button
          className="glass-btn glass-btn-primary glass-btn-lg glass-animate max-w-sm"
          onClick={() => navigate(-1)}
        >
          {t("qr.generateNew")}
        </button>
      )}
    </div>
  );
}
