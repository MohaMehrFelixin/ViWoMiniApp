import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Household, HouseholdMember } from "../lib/types";
import * as couponApi from "../api/coupon";

interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  loggedOut: boolean;

  fetchHousehold: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  register: (
    nationalCode: string,
    address: string,
    lat: number,
    lng: number
  ) => Promise<void>;
  addMember: (
    data: Parameters<typeof couponApi.addMember>[0]
  ) => Promise<void>;
  clear: () => void;
}

export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set, get) => ({
      household: null,
      members: [],
      loading: false,
      error: null,
      lastFetched: null,
      loggedOut: false,

      fetchHousehold: async () => {
        if (get().loggedOut) return;
        set({ loading: true, error: null });
        try {
          const res = await couponApi.getHousehold();
          set({
            household: res.household,
            members: res.members,
            loading: false,
            lastFetched: Date.now(),
          });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to load household";
          set({ loading: false, error: msg });
        }
      },

      fetchMembers: async () => {
        try {
          const res = await couponApi.getMembers();
          set({ members: res.members });
        } catch {
          // keep stale members on failure
        }
      },

      register: async (nationalCode, address, lat, lng) => {
        set({ loading: true, error: null, loggedOut: false });
        try {
          const household = await couponApi.registerHousehold({
            national_code: nationalCode,
            address,
            lat,
            lng,
          });
          set({ household, loading: false, lastFetched: Date.now() });
          get().fetchMembers();
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Registration failed";
          set({ loading: false, error: msg });
          throw err;
        }
      },

      addMember: async (data) => {
        set({ loading: true, error: null });
        try {
          await couponApi.addMember(data);
          set({ loading: false });
          get().fetchMembers();
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to add member";
          set({ loading: false, error: msg });
          throw err;
        }
      },

      clear: () =>
        set({
          household: null,
          members: [],
          loading: false,
          error: null,
          lastFetched: null,
          loggedOut: true,
        }),
    }),
    {
      name: "miniviwo-household",
      partialize: (state) => ({
        household: state.household,
        members: state.members,
        lastFetched: state.lastFetched,
        loggedOut: state.loggedOut,
      }),
    }
  )
);
