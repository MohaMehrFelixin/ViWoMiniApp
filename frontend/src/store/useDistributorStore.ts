import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerProvider, getProviderRegistrationStatus } from "../api/coupon";
import { getLocation } from "../lib/telegram";

// Distributor (provider) registration is now backed by the server. The local
// store still caches the last-known state for instant UX, but `setDistributor`
// POSTs to `/provider/register` so the admin panel can review applications.

export type DistributorStatus = "none" | "pending" | "approved" | "rejected";

export interface DistributorState {
  isDistributor: boolean;
  storeAddress: string;
  storeDescription: string;
  status: DistributorStatus;
  /**
   * Set + POST to backend. Resolves the user's geolocation via the Telegram
   * client (best-effort) so the admin panel can show a map. Throws on network
   * failure so the caller can surface an error.
   */
  setDistributor: (
    isDistributor: boolean,
    storeAddress: string,
    storeDescription: string
  ) => Promise<void>;
  setStatus: (status: DistributorStatus) => void;
  /** Re-hydrate from backend on app load. */
  syncFromBackend: () => Promise<void>;
  clear: () => void;
}

export const useDistributorStore = create<DistributorState>()(
  persist(
    (set, get) => ({
      isDistributor: false,
      storeAddress: "",
      storeDescription: "",
      status: "none",

      setDistributor: async (isDistributor, storeAddress, storeDescription) => {
        if (isDistributor && storeAddress) {
          // Best-effort location for the admin map view. Don't fail if the
          // user denies — admin can fill in coordinates later.
          let lat = 0;
          let lng = 0;
          try {
            const loc = await getLocation();
            if (loc) {
              lat = loc.lat;
              lng = loc.lng;
            }
          } catch {
            // Ignore — coordinates are optional.
          }
          // Default to a "general_distributor" service type code; the admin
          // panel can re-categorize. The catalog of service types lives in
          // `provider_service_types` table.
          await registerProvider({
            service_type_code: "general_distributor",
            store_address: storeAddress,
            store_description: storeDescription,
            lat,
            lng,
          });
          set({
            isDistributor: true,
            storeAddress,
            storeDescription,
            status: "pending",
          });
        } else {
          set({
            isDistributor: false,
            storeAddress: "",
            storeDescription: "",
            status: "none",
          });
        }
      },

      setStatus: (status) => set({ status }),

      syncFromBackend: async () => {
        try {
          const res = await getProviderRegistrationStatus();
          if (res.is_provider) {
            set({
              isDistributor: true,
              status: (res.status as DistributorStatus) ?? "pending",
            });
          }
        } catch {
          // Not registered — ignore.
          if (get().isDistributor) {
            set({ isDistributor: false, storeAddress: "", storeDescription: "", status: "none" });
          }
        }
      },

      clear: () =>
        set({
          isDistributor: false,
          storeAddress: "",
          storeDescription: "",
          status: "none",
        }),
    }),
    {
      name: "miniviwo-distributor",
    }
  )
);
