import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface Notice {
  id: string;
  text: string;
  textFa: string;
  type: "info" | "warning" | "promo";
  link?: string;
}

// Mock notices — in production these come from an admin panel API
const MOCK_NOTICES: Notice[] = [
  {
    id: "n1",
    text: "Water distribution schedule updated for Week 2",
    textFa: "برنامه توزیع آب هفته ۲ به‌روز شد",
    type: "info",
  },
  {
    id: "n2",
    text: "New distribution center opened in Sadeghiyeh",
    textFa: "مرکز توزیع جدید در صادقیه افتتاح شد",
    type: "promo",
  },
  {
    id: "n3",
    text: "Bring your ID card for KYC upgrade — get 100% allocation",
    textFa: "کارت ملی خود را برای ارتقای احراز هویت بیاورید — ۱۰۰٪ سهمیه",
    type: "warning",
  },
  {
    id: "n4",
    text: "Volunteer doctors needed at District 12 center",
    textFa: "نیاز به پزشکان داوطلب در مرکز منطقه ۱۲",
    type: "info",
  },
  {
    id: "n5",
    text: "Fuel allocation increased by 15% this month",
    textFa: "سهمیه سوخت این ماه ۱۵٪ افزایش یافت",
    type: "promo",
  },
];

const TYPE_STYLES: Record<Notice["type"], { dot: string; bg: string }> = {
  info: { dot: "rgb(59,130,246)", bg: "rgba(59,130,246,0.08)" },
  warning: { dot: "rgb(234,179,8)", bg: "rgba(234,179,8,0.08)" },
  promo: { dot: "rgb(34,197,94)", bg: "rgba(34,197,94,0.08)" },
};

export function NoticeBanner() {
  const { i18n } = useTranslation();
  const isFa = i18n.language === "fa";
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notices = MOCK_NOTICES;

  const advance = useCallback(() => {
    setCurrent((prev) => (prev + 1) % notices.length);
  }, [notices.length]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(advance, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, advance]);

  // Swipe support
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    // In RTL, swipe directions are reversed
    const threshold = 40;
    if (Math.abs(dx) > threshold) {
      const dir = isFa ? -dx : dx;
      if (dir < 0) setCurrent((prev) => (prev + 1) % notices.length);
      else setCurrent((prev) => (prev - 1 + notices.length) % notices.length);
    }
    setPaused(false);
  };

  if (notices.length === 0) return null;

  const notice = notices[current];
  const style = TYPE_STYLES[notice.type];

  return (
    <div
      className="glass overflow-hidden"
      style={{ borderRadius: "14px" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: style.bg, minHeight: 44 }}
      >
        {/* Dot indicator */}
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: style.dot }}
        />

        {/* Text */}
        <p className="text-primary flex-1 text-xs font-medium leading-snug">
          {isFa ? notice.textFa : notice.text}
        </p>

        {/* Pagination dots */}
        <div className="flex shrink-0 gap-1">
          {notices.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); setPaused(false); }}
              className="rounded-full"
              style={{
                width: i === current ? 12 : 5,
                height: 5,
                background: i === current ? style.dot : "var(--separator)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
