import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getNotices } from "../api/coupon";
import type { Notice } from "../lib/types";

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
  const [notices, setNotices] = useState<Notice[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotices()
      .then((res) => { if (!cancelled) setNotices(res.notices ?? []); })
      .catch(() => { /* fail silently — no notices is fine */ });
    return () => { cancelled = true; };
  }, []);

  const advance = useCallback(() => {
    setCurrent((prev) => notices.length > 0 ? (prev + 1) % notices.length : 0);
  }, [notices.length]);

  useEffect(() => {
    if (paused || notices.length === 0) return;
    timerRef.current = setInterval(advance, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, advance, notices.length]);

  // Swipe support
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (notices.length === 0) { setPaused(false); return; }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
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
  if (!notice) return null;
  const style = TYPE_STYLES[notice.type] ?? TYPE_STYLES.info;

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
          {isFa ? notice.text_fa : notice.text}
        </p>

        {/* Pagination dots */}
        <div className="flex shrink-0 gap-0.5">
          {notices.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); setPaused(false); }}
              className="flex items-center justify-center"
              style={{ minWidth: 24, minHeight: 24 }}
            >
              <span
                className="rounded-full"
                style={{
                  width: i === current ? 12 : 5,
                  height: 5,
                  background: i === current ? style.dot : "var(--separator)",
                  transition: "all 0.3s ease",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
