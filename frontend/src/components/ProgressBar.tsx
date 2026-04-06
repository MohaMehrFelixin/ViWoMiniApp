interface ProgressBarProps {
  percent: number;
  color: string;
  height?: number;
}

export function ProgressBar({
  percent,
  color,
  height = 6,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: "var(--separator)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
