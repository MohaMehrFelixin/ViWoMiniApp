export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="glass glass-animate flex flex-col items-center gap-3 px-8 py-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--lg-text-tertiary)", borderTopColor: "transparent" }}
        />
        <span className="text-secondary text-sm">...</span>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl"
          style={{
            height: "14px",
            background: "var(--lg-bg-subtle)",
            width: `${85 - i * 15}%`,
          }}
        />
      ))}
    </div>
  );
}
