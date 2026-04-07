import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerVolunteer, getVolunteerStatus } from "../api/coupon";

// Volunteer registration is now backed by the server. The local store still
// caches the last-known state for instant UX, but `setVolunteer()` POSTs to
// `/volunteer/register` so the admin panel can review applications.
//
// Behavior:
//   - setVolunteer(true, "physician") → backend POST + cache update.
//   - setVolunteer(false, null)       → cache clear (no DELETE endpoint
//     since opting out is rare; the admin panel can suspend instead).
//   - syncFromBackend()               → re-hydrate the cache from
//     /volunteer/status on app load (catches edits made via admin panel).

export interface VolunteerState {
  isVolunteer: boolean;
  specialty: string | null;
  status: "none" | "pending" | "approved" | "rejected" | "suspended";
  /** Set + POST to backend. Throws on network failure so caller can show
   *  an error toast. */
  setVolunteer: (isVolunteer: boolean, specialty: string | null) => Promise<void>;
  /** Re-hydrate from backend on app load. Silently no-ops if not registered. */
  syncFromBackend: () => Promise<void>;
  clear: () => void;
}

export const useVolunteerStore = create<VolunteerState>()(
  persist(
    (set, get) => ({
      isVolunteer: false,
      specialty: null,
      status: "none",

      setVolunteer: async (isVolunteer, specialty) => {
        if (isVolunteer && specialty) {
          // Persist to backend first; only update local cache on success so
          // we don't end up with state that doesn't match the server.
          await registerVolunteer(specialty);
          set({ isVolunteer: true, specialty, status: "pending" });
        } else {
          // Opt-out: clear local cache. Backend keeps the historical record
          // but the user can re-apply later.
          set({ isVolunteer: false, specialty: null, status: "none" });
        }
      },

      syncFromBackend: async () => {
        try {
          const res = await getVolunteerStatus();
          if (res.is_volunteer) {
            set({
              isVolunteer: true,
              specialty: res.specialty,
              status: (res.status as VolunteerState["status"]) ?? "pending",
            });
          }
        } catch {
          // 404 / 401 → not registered. Don't surface as error.
          if (get().isVolunteer) {
            // Local cache says yes but backend disagrees — clear stale cache.
            set({ isVolunteer: false, specialty: null, status: "none" });
          }
        }
      },

      clear: () => set({ isVolunteer: false, specialty: null, status: "none" }),
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
