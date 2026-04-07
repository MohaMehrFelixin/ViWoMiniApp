import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ProductOffering {
  productName: string;
  productNameFa: string;
  quantity: string;
  unit: string;
  description: string;
}

interface ProductOfferingState {
  hasOffering: boolean;
  offerings: ProductOffering[];
  setOfferings: (hasOffering: boolean, offerings: ProductOffering[]) => void;
  clear: () => void;
}

export const useProductOfferingStore = create<ProductOfferingState>()(
  persist(
    (set) => ({
      hasOffering: false,
      offerings: [],

      setOfferings: (hasOffering, offerings) =>
        set({
          hasOffering,
          offerings: hasOffering ? offerings : [],
        }),

      clear: () =>
        set({
          hasOffering: false,
          offerings: [],
        }),
    }),
    { name: "miniviwo-product-offering" }
  )
);
