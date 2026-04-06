import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { secondsUntil, formatCountdown } from "../lib/utils";

interface CountdownTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function CountdownTimer({ expiresAt, onExpired }: CountdownTimerProps) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    if (remaining <= 0) {
      onExpired?.();
      return;
    }
    const interval = setInterval(() => {
      const next = secondsUntil(expiresAt);
      setRemaining(next);
      if (next <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired, remaining]);

  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 120;

  return (
    <div className="glass-subtle flex flex-col items-center gap-1 rounded-2xl px-6 py-3">
      {isExpired ? (
        <span className="text-lg font-bold" style={{ color: "var(--cat-medical)" }}>
          {t("qr.expired")}
        </span>
      ) : (
        <>
          <span className="text-tertiary text-xs">{t("qr.expiresIn")}</span>
          <span
            className="text-3xl font-bold tabular-nums tracking-wider"
            style={isUrgent ? { color: "var(--cat-medical)" } : undefined}
          >
            {formatCountdown(remaining)}
          </span>
        </>
      )}
    </div>
  );
}
