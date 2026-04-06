import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoryBalance } from "../lib/types";
import * as couponApi from "../api/coupon";

interface BalanceState {
  balances: CategoryBalance[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchBalances: () => Promise<void>;
  clear: () => void;
}

export const useBalanceStore = create<BalanceState>()(
  persist(
    (set) => ({
      balances: [],
      loading: false,
      error: null,
      lastFetched: null,

      fetchBalances: async () => {
        set({ loading: true, error: null });
        try {
          const res = await couponApi.getBalances();
          set({
            balances: res.balances,
            loading: false,
            lastFetched: Date.now(),
          });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to load balances";
          set({ loading: false, error: msg });
        }
      },

      clear: () =>
        set({
          balances: [],
          loading: false,
          error: null,
          lastFetched: null,
        }),
    }),
    {
      name: "miniviwo-balances",
      partialize: (state) => ({
        balances: state.balances,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
