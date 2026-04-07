import { useState, useEffect, type ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";

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
}

export function PageShell<T>({ title, subtitle, columns, fetchData, getRowKey, actions }: PageShellProps<T>) {
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
          setData(res.items);
          setTotal(res.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, fetchData, retryCount]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>{title}</h1>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>{subtitle}</p>}
        </div>
        {actions}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle size={32} style={{ color: "var(--danger)" }} />
            <p className="text-sm" style={{ color: "var(--text-2)" }}>{error}</p>
            <button className="btn" onClick={() => setRetryCount((c) => c + 1)}>Retry</button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm" style={{ color: "var(--text-3)" }}>No data found</p>
          </div>
        ) : (
          <>
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
                  <tr key={getRowKey(row)}>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  {total.toLocaleString()} total · Page {page} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                  <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
