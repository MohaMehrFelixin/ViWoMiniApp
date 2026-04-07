import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderProfile, ProviderStats, ProviderSession } from "../lib/types";
import * as couponApi from "../api/coupon";

// Max age before persisted profile is considered stale and must be re-fetched
const PROFILE_MAX_AGE_MS = 5 * 60_000; // 5 minutes

interface ProviderState {
  profile: ProviderProfile | null;
  stats: ProviderStats | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  /** True after the first fetch attempt (success or fail). Prevents re-fetching for non-providers. */
  checked: boolean;

  fetchProfile: () => Promise<void>;
  fetchStats: () => Promise<void>;
  openSession: () => Promise<ProviderSession>;
  closeSession: () => Promise<ProviderSession>;
  clear: () => void;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      profile: null,
      stats: null,
      loading: false,
      error: null,
      lastFetched: null,
      checked: false,

      fetchProfile: async () => {
        set({ loading: true, error: null });
        try {
          const res = await couponApi.getProviderProfile();
          set({
            profile: res.provider,
            loading: false,
            lastFetched: Date.now(),
            checked: true,
          });
        } catch {
          // In dev mode, seed a mock approved provider so the Store tab is visible
          if (import.meta.env.DEV) {
            set({
              profile: {
                id: 1,
                name: "Dev Store",
                name_fa: "\u0641\u0631\u0648\u0634\u06AF\u0627\u0647 \u062A\u0633\u062A",
                type: "distributor",
                service_type: "grocery",
                status: "approved",
                store_address: "123 Test St",
                store_address_fa: "\u062E\u06CC\u0627\u0628\u0627\u0646 \u062A\u0633\u062A \u06F1\u06F2\u06F3",
                distribution_point_id: 1,
                created_at: new Date().toISOString(),
              },
              loading: false,
              lastFetched: Date.now(),
              checked: true,
            });
            return;
          }
          // Production: user is not a provider, or API error.
          // Clear stale cached profile and mark as checked so Layout doesn't re-fetch.
          set({ profile: null, loading: false, error: null, checked: true, lastFetched: null });
        }
      },

      fetchStats: async () => {
        try {
          const res = await couponApi.getProviderStats();
          set({ stats: res.stats });
        } catch {
          // In dev mode, seed mock stats
          if (import.meta.env.DEV && !get().stats) {
            set({
              stats: {
                today: {
                  transactions: 7,
                  by_category: [
                    { category: "food", count: 4, total_amount: "12" },
                    { category: "water", count: 3, total_amount: "45" },
                  ],
                },
                total: {
                  transactions: 142,
                  days_worked: 18,
                  total_hours: 126.5,
                  by_category: [
                    { category: "food", count: 68, total_amount: "340" },
                    { category: "water", count: 52, total_amount: "1560" },
                    { category: "hygiene", count: 22, total_amount: "88" },
                  ],
                },
                current_session: null,
              },
            });
          }
        }
      },

      openSession: async () => {
        let session;
        try {
          const res = await couponApi.openProviderSession();
          session = res.session;
        } catch {
          if (!import.meta.env.DEV) throw new Error("Failed to open session");
          session = {
            id: Date.now(),
            provider_id: get().profile?.id ?? 1,
            opened_at: new Date().toISOString(),
            closed_at: null,
            duration_minutes: 0,
          };
        }
        const { stats } = get();
        if (stats) {
          set({ stats: { ...stats, current_session: session } });
        }
        return session;
      },

      closeSession: async () => {
        const { stats } = get();
        const currentSession = stats?.current_session;
        let session;
        try {
          const res = await couponApi.closeProviderSession();
          session = res.session;
        } catch {
          if (!import.meta.env.DEV) throw new Error("Failed to close session");
          session = {
            id: currentSession?.id ?? Date.now(),
            provider_id: get().profile?.id ?? 1,
            opened_at: currentSession?.opened_at ?? new Date().toISOString(),
            closed_at: new Date().toISOString(),
            duration_minutes: currentSession
              ? Math.round((Date.now() - new Date(currentSession.opened_at).getTime()) / 60000)
              : 0,
          };
        }
        if (stats) {
          set({ stats: { ...stats, current_session: null } });
        }
        // Refresh stats so days_worked/total_hours update
        get().fetchStats();
        return session;
      },

      clear: () =>
        set({
          profile: null,
          stats: null,
          loading: false,
          error: null,
          lastFetched: null,
          checked: false,
        }),
    }),
    {
      name: "miniviwo-provider",
      partialize: (state) => ({
        profile: state.profile,
        lastFetched: state.lastFetched,
        // Don't persist `checked` — always re-check on fresh app load
      }),
    }
  )
);

/** Returns true if the cached profile is stale and should be re-fetched. */
export function isProfileStale(): boolean {
  const { lastFetched } = useProviderStore.getState();
  if (!lastFetched) return true;
  return Date.now() - lastFetched > PROFILE_MAX_AGE_MS;
}
