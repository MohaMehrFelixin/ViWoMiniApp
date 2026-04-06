import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface KycData {
  nationalCode: string;
  mobile: string;
  fullName: string;
  birthDate: string;
  gender: string;
  address: string;
  lat: number;
  lng: number;
  kycTier: number;
  completedAt: string;
  kycTrackId: string;
  otpVerified: boolean;
  identityVerified: boolean;
  otpAttempts: number;
  otpSendCount: number;
}

interface KycState {
  completed: boolean;
  data: KycData | null;
  currentStep: number;

  // Draft fields (not persisted until complete)
  draft: Partial<KycData>;

  setStep: (step: number) => void;
  updateDraft: (fields: Partial<KycData>) => void;
  completeKyc: (data: KycData) => void;
  reset: () => void;
}

export const useKycStore = create<KycState>()(
  persist(
    (set) => ({
      completed: false,
      data: null,
      currentStep: 0,
      draft: {},

      setStep: (step) => set({ currentStep: step }),

      updateDraft: (fields) =>
        set((state) => ({ draft: { ...state.draft, ...fields } })),

      completeKyc: (data) =>
        set({
          completed: true,
          data,
          currentStep: 0,
          draft: {},
        }),

      reset: () =>
        set({
          completed: false,
          data: null,
          currentStep: 0,
          draft: {},
        }),
    }),
    {
      name: "miniviwo-kyc",
      partialize: (state) => ({
        completed: state.completed,
        data: state.data,
        currentStep: state.currentStep,
        draft: state.draft,
      }),
    }
  )
);
