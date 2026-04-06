const persianDigits = [
  "\u06F0",
  "\u06F1",
  "\u06F2",
  "\u06F3",
  "\u06F4",
  "\u06F5",
  "\u06F6",
  "\u06F7",
  "\u06F8",
  "\u06F9",
];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => persianDigits[parseInt(d)]!);
}

export function formatAmount(
  amount: string | number,
  locale: string = "fa"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return locale === "fa" ? toPersianDigits(formatted) : formatted;
}

export function formatDate(
  isoDate: string,
  locale: string = "fa"
): string {
  const date = new Date(isoDate);
  if (locale === "fa") {
    return date.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeAgo(isoDate: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo").replace("{{n}}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo").replace("{{n}}", String(hours));
  const days = Math.floor(hours / 24);
  return t("time.daysAgo").replace("{{n}}", String(days));
}

export function calcUsagePercent(
  used: string,
  total: string
): number {
  const u = parseFloat(used);
  const t = parseFloat(total);
  if (t <= 0) return 0;
  return Math.min(100, Math.round((u / t) * 100));
}

export function getWeekNumber(): number {
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const week = Math.ceil(dayOfMonth / 7);
  return Math.min(week, 4);
}

export function secondsUntil(isoDate: string): number {
  return Math.max(0, Math.floor((new Date(isoDate).getTime() - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
