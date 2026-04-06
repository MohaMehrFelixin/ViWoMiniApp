import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PowerBankSwap, HouseholdMember } from "../lib/types";
import {
  getPowerBankSwaps,
  requestPowerBankSwap,
  pickUpPowerBank,
  returnPowerBank,
  cancelPowerBankSwap,
  getNearbyCenters,
} from "../api/coupon";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { IconEnergy } from "./Icons";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F97316",
  ready: "#3B82F6",
  picked_up: "#22C55E",
  returned: "#6B7280",
  cancelled: "#EF4444",
};

export function PowerBankCard() {
  const { t } = useTranslation();
  const { members } = useHouseholdStore();
  const [active, setActive] = useState<PowerBankSwap | null>(null);
  const [history, setHistory] = useState<PowerBankSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the FIRST member (head of household registered by this Telegram user) exists
  // In the current system, the first member added is always the head
  const headMember = members.find(
    (m: HouseholdMember) => m.relationship.toLowerCase() === "head"
  );
  const isHead = !!headMember;

  const fetchSwaps = async () => {
    try {
      const res = await getPowerBankSwaps();
      setActive(res.active_swap);
      setHistory(res.swaps);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwaps();
  }, []);

  const handleRequest = async () => {
    setActing(true);
    setError(null);
    try {
      // Find nearest energy distribution center via geolocation
      let centerID: number | null = null;
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });
      const lat = pos?.coords.latitude ?? 35.6892;
      const lng = pos?.coords.longitude ?? 51.389;
      const nearby = await getNearbyCenters(lat, lng, "energy");
      if (nearby.centers.length > 0) {
        centerID = nearby.centers[0]?.id ?? null;
      }
      if (!centerID) {
        setError(t("powerbank.noCenterFound") || "No energy center found nearby");
        return;
      }
      const res = await requestPowerBankSwap(centerID);
      setActive(res.swap);
      await fetchSwaps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handlePickup = async () => {
    if (!active) return;
    setActing(true);
    try {
      await pickUpPowerBank(active.id);
      await fetchSwaps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handleReturn = async () => {
    if (!active) return;
    setActing(true);
    try {
      await returnPowerBank(active.id);
      await fetchSwaps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!active) return;
    setActing(true);
    try {
      await cancelPowerBankSwap(active.id);
      await fetchSwaps();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const statusLabel = (s: string) => t(`powerbank.status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`);

  if (loading) return null;

  return (
    <div className="glass glass-animate space-y-4 p-5" style={{ animationDelay: "300ms" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(234,179,8,0.15)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="12" height="18" rx="2" />
            <line x1="10" y1="1" x2="14" y2="1" />
            <line x1="9" y1="10" x2="15" y2="10" />
            <line x1="12" y1="7" x2="12" y2="13" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-primary font-bold">{t("powerbank.title")}</h2>
          <p className="text-tertiary text-xs">{t("powerbank.subtitle")}</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308" }}
        >
          {t("powerbank.headOnly")}
        </span>
      </div>

      {/* Swap flow illustration */}
      <div className="glass-subtle flex items-center justify-between rounded-2xl p-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(239,68,68,0.1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="18" rx="2" />
              <line x1="10" y1="1" x2="14" y2="1" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
          </div>
          <span className="text-tertiary text-[10px]">
            {active?.status === "picked_up" ? t("powerbank.return") : ""}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          <span className="text-tertiary text-[10px] font-medium">{t("powerbank.request")}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(34,197,94,0.1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="18" rx="2" />
              <line x1="10" y1="1" x2="14" y2="1" />
              <line x1="12" y1="9" x2="12" y2="15" />
              <line x1="9" y1="12" x2="15" y2="12" />
            </svg>
          </div>
          <span className="text-tertiary text-[10px]">
            <IconEnergy size={10} />
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-center text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
          {error}
        </div>
      )}

      {/* Active swap card */}
      {active ? (
        <div className="glass-subtle space-y-3 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: `${STATUS_COLORS[active.status] || "#6B7280"}18`,
                color: STATUS_COLORS[active.status] || "#6B7280",
              }}
            >
              {statusLabel(active.status)}
            </span>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--accent)", letterSpacing: 1 }}>
              {active.swap_code}
            </span>
          </div>

          <p className="text-secondary text-xs leading-relaxed">
            {t("powerbank.bringEmpty")}
          </p>

          <div className="flex gap-2">
            {(active.status === "pending" || active.status === "ready") && (
              <>
                <button
                  className="glass-btn glass-btn-primary glass-btn-sm flex-1"
                  onClick={handlePickup}
                  disabled={acting}
                >
                  {t("powerbank.pickup")}
                </button>
                <button
                  className="glass-btn glass-btn-sm flex-1"
                  onClick={handleCancel}
                  disabled={acting}
                  style={{ color: "#EF4444" }}
                >
                  {t("powerbank.cancel")}
                </button>
              </>
            )}
            {active.status === "picked_up" && (
              <button
                className="glass-btn glass-btn-primary glass-btn-lg"
                onClick={handleReturn}
                disabled={acting}
              >
                {t("powerbank.return")}
              </button>
            )}
          </div>
        </div>
      ) : isHead ? (
        <button
          className="glass-btn glass-btn-primary glass-btn-lg"
          onClick={handleRequest}
          disabled={acting}
        >
          {acting ? t("powerbank.requesting") : t("powerbank.request")}
        </button>
      ) : (
        <div className="glass-subtle rounded-2xl p-4 text-center">
          <p className="text-tertiary text-sm">{t("powerbank.headOnly")}</p>
        </div>
      )}

      {/* Swap history */}
      {history.filter((s) => s.status === "returned" || s.status === "cancelled").length > 0 && (
        <div className="space-y-2">
          {history
            .filter((s) => s.status === "returned" || s.status === "cancelled")
            .slice(0, 3)
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: "var(--separator)" }}
              >
                <span className="font-mono text-xs" style={{ color: "var(--text-2)" }}>
                  {s.swap_code}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: `${STATUS_COLORS[s.status] || "#6B7280"}15`,
                    color: STATUS_COLORS[s.status] || "#6B7280",
                  }}
                >
                  {statusLabel(s.status)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
