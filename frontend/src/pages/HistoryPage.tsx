import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { CouponRedemption } from "../lib/types";
import { getRedemptionHistory, disputeRedemption } from "../api/coupon";
import { RedemptionItem } from "../components/RedemptionItem";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { IconHistory } from "../components/Icons";

export function HistoryPage() {
  const { t } = useTranslation();
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [cursor, setCursor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);

  const fetchHistory = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRedemptionHistory(isLoadMore ? cursor : undefined);
      if (isLoadMore) {
        setRedemptions((prev) => [...prev, ...res.redemptions]);
      } else {
        setRedemptions(res.redemptions);
      }
      setCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor]);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDispute = async () => {
    if (!disputeId || disputeReason.length < 10) return;
    setDisputeLoading(true);
    try {
      await disputeRedemption(disputeId, disputeReason);
      setRedemptions((prev) =>
        prev.map((r) => (r.id === disputeId ? { ...r, status: "disputed" } : r))
      );
      setDisputeId(null);
      setDisputeReason("");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setError("Failed to submit dispute");
    } finally {
      setDisputeLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error && redemptions.length === 0)
    return <ErrorState message={error} onRetry={() => fetchHistory()} />;

  if (redemptions.length === 0) {
    return <EmptyState icon={<IconHistory size={48} />} title={t("history.noHistory")} />;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-primary text-xl font-bold">{t("history.title")}</h1>

      <div className="glass glass-animate space-y-2 p-3">
        {redemptions.map((r) => (
          <RedemptionItem key={r.id} redemption={r} onDispute={(id) => setDisputeId(id)} />
        ))}
      </div>

      {cursor && (
        <button
          className="glass-btn glass-btn-lg"
          onClick={() => fetchHistory(true)}
          disabled={loadingMore}
        >
          {loadingMore ? "..." : t("history.loadMore")}
        </button>
      )}

      {disputeId !== null && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            onClick={() => { setDisputeId(null); setDisputeReason(""); }}
          />
          <div className="glass glass-prominent glass-animate fixed inset-x-4 bottom-24 z-50 space-y-4 p-5">
            <h3 className="text-primary font-bold">{t("history.submitDispute")}</h3>
            <input
              className="glass-input"
              placeholder={t("history.disputeReason")}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              aria-label={t("history.disputeReason")}
            />
            <div className="flex gap-3">
              <button className="glass-btn flex-1" onClick={() => { setDisputeId(null); setDisputeReason(""); }}>
                {t("common.cancel")}
              </button>
              <button
                className="glass-btn glass-btn-primary flex-1"
                onClick={handleDispute}
                disabled={disputeReason.length < 10 || disputeLoading}
              >
                {disputeLoading ? "..." : t("history.submitDispute")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
