import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DistributorStatus = "none" | "pending" | "approved" | "rejected";

export interface DistributorState {
  isDistributor: boolean;
  storeAddress: string;
  storeDescription: string;
  status: DistributorStatus;
  setDistributor: (
    isDistributor: boolean,
    storeAddress: string,
    storeDescription: string
  ) => void;
  setStatus: (status: DistributorStatus) => void;
  clear: () => void;
}

export const useDistributorStore = create<DistributorState>()(
  persist(
    (set) => ({
      isDistributor: false,
      storeAddress: "",
      storeDescription: "",
      status: "none",

      setDistributor: (isDistributor, storeAddress, storeDescription) =>
        set({
          isDistributor,
          storeAddress: isDistributor ? storeAddress : "",
          storeDescription: isDistributor ? storeDescription : "",
          status: isDistributor ? "pending" : "none",
        }),

      setStatus: (status) => set({ status }),

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
