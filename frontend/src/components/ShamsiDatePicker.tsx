import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toJalaali, toGregorian, jalaaliMonthLength } from "jalaali-js";

const SHAMSI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند",
];

const SHAMSI_MONTHS_EN = [
  "Farvardin", "Ordibehesht", "Khordad",
  "Tir", "Mordad", "Shahrivar",
  "Mehr", "Aban", "Azar",
  "Dey", "Bahman", "Esfand",
];

interface ShamsiDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

export function ShamsiDatePicker({ value, onChange, className, "aria-label": ariaLabel }: ShamsiDatePickerProps) {
  const { i18n } = useTranslation();
  const isFa = i18n.language === "fa";

  const initial = useMemo(() => {
    if (!value) return { jy: 0, jm: 0, jd: 0 };
    const [gy, gm, gd] = value.split("-").map(Number);
    if (!gy || !gm || !gd) return { jy: 0, jm: 0, jd: 0 };
    return toJalaali(gy, gm, gd);
  }, [value]);

  const now = toJalaali(new Date());
  const [jy, setJy] = useState(initial.jy || now.jy - 25);
  const [jm, setJm] = useState(initial.jm || 1);
  const [jd, setJd] = useState(initial.jd || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"year" | "month" | "day">("year");
  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial.jy) {
      setJy(initial.jy);
      setJm(initial.jm);
      setJd(initial.jd);
    }
  }, [initial.jy, initial.jm, initial.jd]);

  useEffect(() => {
    if (open && step === "year" && yearListRef.current) {
      const el = yearListRef.current.querySelector("[data-selected]");
      if (el) el.scrollIntoView({ block: "center" });
    }
  }, [open, step]);

  const daysInMonth = useMemo(() => {
    if (!jy || !jm) return 31;
    return jalaaliMonthLength(jy, jm);
  }, [jy, jm]);

  useEffect(() => {
    if (jd > daysInMonth) setJd(daysInMonth);
  }, [daysInMonth, jd]);

  const formatNum = (n: number) =>
    isFa ? n.toLocaleString("fa-IR", { useGrouping: false }) : String(n);

  const monthLabel = (m: number) => (isFa ? SHAMSI_MONTHS[m - 1] : SHAMSI_MONTHS_EN[m - 1]);

  const displayText = jy && jm && jd
    ? `${formatNum(jd)} ${monthLabel(jm)} ${formatNum(jy)}`
    : isFa ? "تاریخ تولد" : "Date of birth";

  const handleOpen = () => {
    setStep("year");
    setOpen(true);
  };

  const selectYear = (y: number) => {
    setJy(y);
    setStep("month");
  };

  const selectMonth = (m: number) => {
    setJm(m);
    setStep("day");
  };

  const selectDay = (d: number) => {
    const safeDay = Math.min(d, daysInMonth);
    setJd(safeDay);
    const { gy, gm, gd } = toGregorian(jy, jm, safeDay);
    onChange(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`);
    setOpen(false);
  };

  const isDark = typeof document !== "undefined" && (
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const colors = {
    bg: isDark ? "#1c1c1e" : "#ffffff",
    surface: isDark ? "#2c2c2e" : "#f2f2f7",
    surfaceHover: isDark ? "#3a3a3c" : "#e5e5ea",
    border: isDark ? "#3a3a3c" : "#d1d1d6",
    text: isDark ? "#ffffff" : "#000000",
    textSecondary: isDark ? "#ababab" : "#6b6b6b",
    accent: "#007AFF",
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`${className || "glass-input"} w-full text-start`}
        aria-label={ariaLabel}
      >
        <span className={jy && jm && jd ? "text-primary" : "text-tertiary"}>
          {displayText}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.bg,
              borderRadius: 20,
              width: "100%",
              maxWidth: 360,
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px 12px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
                {isFa ? "انتخاب تاریخ" : "Select Date"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                <button
                  type="button"
                  onClick={() => setStep("year")}
                  style={{
                    background: step === "year" ? colors.accent : colors.surface,
                    color: step === "year" ? "#fff" : colors.textSecondary,
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {jy ? formatNum(jy) : "—"}
                </button>
                <span style={{ color: colors.textSecondary }}>/</span>
                <button
                  type="button"
                  onClick={() => jy && setStep("month")}
                  style={{
                    background: step === "month" ? colors.accent : colors.surface,
                    color: step === "month" ? "#fff" : colors.textSecondary,
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {jm ? monthLabel(jm) : "—"}
                </button>
                <span style={{ color: colors.textSecondary }}>/</span>
                <span
                  style={{
                    background: step === "day" ? colors.accent : colors.surface,
                    color: step === "day" ? "#fff" : colors.textSecondary,
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontWeight: 600,
                  }}
                >
                  {jd ? formatNum(jd) : "—"}
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 16 }}>
              {/* Year */}
              {step === "year" && (
                <div
                  ref={yearListRef}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  {Array.from({ length: now.jy - 1300 + 1 }, (_, i) => now.jy - i).map((y) => (
                    <button
                      key={y}
                      type="button"
                      data-selected={jy === y ? "" : undefined}
                      onClick={() => selectYear(y)}
                      style={{
                        height: 42,
                        borderRadius: 10,
                        border: "none",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        background: jy === y ? colors.accent : colors.surface,
                        color: jy === y ? "#fff" : colors.text,
                      }}
                    >
                      {formatNum(y)}
                    </button>
                  ))}
                </div>
              )}

              {/* Month */}
              {step === "month" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {SHAMSI_MONTHS.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectMonth(i + 1)}
                      style={{
                        height: 44,
                        borderRadius: 10,
                        border: "none",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        background: jm === i + 1 ? colors.accent : colors.surface,
                        color: jm === i + 1 ? "#fff" : colors.text,
                      }}
                    >
                      {isFa ? SHAMSI_MONTHS[i] : SHAMSI_MONTHS_EN[i]}
                    </button>
                  ))}
                </div>
              )}

              {/* Day */}
              {step === "day" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 6,
                  }}
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => selectDay(d)}
                      style={{
                        height: 40,
                        borderRadius: 10,
                        border: "none",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        background: jd === d ? colors.accent : colors.surface,
                        color: jd === d ? "#fff" : colors.text,
                      }}
                    >
                      {formatNum(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 16px 16px",
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: colors.surface,
                  color: colors.text,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 32px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isFa ? "بستن" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
