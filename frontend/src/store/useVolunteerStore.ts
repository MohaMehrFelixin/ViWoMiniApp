import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface VolunteerState {
  isVolunteer: boolean;
  specialty: string | null; // null = general, string = specific specialty key
  setVolunteer: (isVolunteer: boolean, specialty: string | null) => void;
  clear: () => void;
}

export const useVolunteerStore = create<VolunteerState>()(
  persist(
    (set) => ({
      isVolunteer: false,
      specialty: null,

      setVolunteer: (isVolunteer, specialty) =>
        set({ isVolunteer, specialty: isVolunteer ? specialty : null }),

      clear: () => set({ isVolunteer: false, specialty: null }),
    }),
    {
      name: "miniviwo-volunteer",
    }
  )
);

// Crisis-critical specialties grouped by domain
export const VOLUNTEER_SPECIALTIES = [
  // Medical
  "physician",
  "surgeon",
  "nurse",
  "paramedic",
  "pharmacist",
  "midwife",
  "dentist",
  "psychologist",
  "veterinarian",
  "lab_technician",
  // Engineering & Infrastructure
  "civil_engineer",
  "electrical_engineer",
  "mechanical_engineer",
  "water_engineer",
  "telecom_engineer",
  "structural_engineer",
  // Emergency & Rescue
  "firefighter",
  "search_rescue",
  "hazmat_specialist",
  "military_personnel",
  "police_officer",
  // Logistics & Transport
  "truck_driver",
  "heavy_equipment_operator",
  "pilot",
  "supply_chain_manager",
  // Technical trades
  "electrician",
  "plumber",
  "welder",
  "mechanic",
  "generator_technician",
  // Communication & Coordination
  "radio_operator",
  "translator",
  "social_worker",
  "teacher",
  "religious_leader",
  // Agriculture & Food
  "agronomist",
  "baker",
  "butcher",
  "water_purification",
] as const;

export type VolunteerSpecialty = (typeof VOLUNTEER_SPECIALTIES)[number];
