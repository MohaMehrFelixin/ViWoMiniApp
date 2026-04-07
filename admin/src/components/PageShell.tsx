import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface PageShellProps<T> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  fetchData: (page: number) => Promise<{ items: T[]; total: number }>;
  getRowKey: (row: T) => string | number;
  actions?: ReactNode;
  onRowClick?: (row: T) => void;
}

// PageShell renders a sortable, paginated data view that ADAPTS to screen size:
//
//   - On screens >= md (768px), render as a classic data table.
//   - On screens < md, render each row as a tappable card. The first column
//     becomes the card title, the rest stack as label/value pairs underneath.
//
// This is the "card view" pattern recommended by UX research for responsive
// admin tables — it preserves all columns instead of hiding them, while
// keeping each row scannable and tap-friendly on a phone.

export function PageShell<T>({
  title,
  subtitle,
  columns,
  fetchData,
  getRowKey,
  actions,
  onRowClick,
}: PageShellProps<T>) {
  const { t } = useTranslation();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const limit = 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchData(page)
      .then((res) => {
        if (!cancelled) {
          setData(Array.isArray(res.items) ? res.items : []);
          setTotal(res.total ?? 0);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, fetchData, retryCount]);

  // Filter out structural / decorative columns from the mobile card view.
  // Anything with empty label and no useful render is dropped.
  const cardColumns = columns.filter((c) => c.key !== "_select" && c.key !== "_actions");
  // First column with content is the title. The rest become metadata rows.
  const titleColumn = cardColumns[0];
  const metaColumns = cardColumns.slice(1);

  const renderCell = (row: T, col: Column<T>): ReactNode => {
    if (col.render) return col.render(row);
    const v = (row as Record<string, unknown>)[col.key];
    return v == null ? "—" : String(v);
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header — stacks on mobile, side-by-side on tablet+ */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: "var(--text-1)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-xs md:text-sm mt-0.5 md:mt-1"
              style={{ color: "var(--text-3)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap gap-2 md:flex-shrink-0">{actions}</div>
        )}
      </div>

      {/* Body */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
            <AlertCircle size={36} style={{ color: "var(--danger)" }} />
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              {error}
            </p>
            <button className="btn" onClick={() => setRetryCount((c) => c + 1)}>
              {t("common.retry")}
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-4 text-center">
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              {t("common.noData")}
            </p>
          </div>
        ) : (
          <>
            {/* ────────── DESKTOP TABLE (md+) ────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr
                      key={getRowKey(row)}
                      onClick={() => onRowClick?.(row)}
                      style={onRowClick ? { cursor: "pointer" } : undefined}
                    >
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[col.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ────────── MOBILE CARD LIST (below md) ────────── */}
            <div className="md:hidden">
              {data.map((row) => (
                <button
                  key={getRowKey(row)}
                  type="button"
                  onClick={() => onRowClick?.(row)}
                  disabled={!onRowClick}
                  className="block w-full text-start"
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    border: "none",
                    borderBlockEnd: "1px solid var(--border)",
                    minHeight: "var(--tap-min)",
                    cursor: onRowClick ? "pointer" : "default",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* Title row — first column rendered prominently */}
                  {titleColumn && (
                    <div
                      className="flex items-center justify-between gap-3"
                      style={{ marginBottom: metaColumns.length ? 8 : 0 }}
                    >
                      <div
                        className="text-sm font-semibold flex-1 min-w-0"
                        style={{ color: "var(--text-1)" }}
                      >
                        {renderCell(row, titleColumn)}
                      </div>
                      {/* Show the LAST column on the right of the title row if
                          it's a status badge or similar — keeps the at-a-glance
                          status visible without scanning. */}
                      {metaColumns.length > 0 && (
                        <div className="flex-shrink-0">
                          {renderCell(row, metaColumns[metaColumns.length - 1])}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta rows — all middle columns as label/value pairs.
                      Excludes the last column (already shown above). */}
                  {metaColumns.length > 1 && (
                    <div
                      className="grid gap-x-3 gap-y-1.5"
                      style={{
                        gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
                      }}
                    >
                      {metaColumns.slice(0, -1).map((col) => (
                        <div className="contents" key={col.key}>
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: "var(--text-3)" }}
                          >
                            {col.label}
                          </span>
                          <span
                            className="text-xs min-w-0 truncate"
                            style={{ color: "var(--text-2)" }}
                          >
                            {renderCell(row, col)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Pagination — touch-friendly, sticky-friendly */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] gap-3"
                style={{ flexWrap: "wrap" }}
              >
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  {total.toLocaleString()} {t("common.total")} · {t("common.page")} {page} {t("common.of")}{" "}
                  {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-icon"
                    style={{ minWidth: 44, minHeight: 44 }}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    aria-label={t("common.previous")}
                  >
                    <ChevronLeft className="rtl:rotate-180" size={20} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ minWidth: 44, minHeight: 44 }}
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    aria-label={t("common.next")}
                  >
                    <ChevronRight className="rtl:rotate-180" size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
