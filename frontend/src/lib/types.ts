export interface Household {
  id: number;
  telegram_user_id: number;
  household_code: string;
  kyc_tier: number;
  address: string;
  lat: number;
  lng: number;
  province_code: string;
  location_segment: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: number;
  household_id: number;
  national_code: string;
  full_name: string;
  birth_date: string;
  gender: string;
  relationship: string;
  age_group: string;
  special_flags: string[];
  kyc_verified: boolean;
  created_at: string;
}

export interface CategoryBalance {
  category: CouponCategory;
  total_amount: string;
  used_amount: string;
  remaining_amount: string;
  available_now: string;
  current_week: number;
  cycle_start: string;
  cycle_end: string;
  status: string;
}

export interface AllBalancesResponse {
  household_id: number;
  balances: CategoryBalance[];
}

export interface HouseholdSummaryResponse {
  household: Household;
  member_count: number;
  members: HouseholdMember[];
}

export interface QRPayload {
  household_id: number;
  category: CouponCategory;
  amount: string;
  coupon_code: string;
  issued_at: string;
  expires_at: string;
  signature: string;
  tier: number;
  nonce: string;
}

export interface GenerateQRResponse {
  qr_data: string;
  payload: QRPayload;
}

export interface CouponRedemption {
  id: number;
  household_id: number;
  allocation_id: number;
  category: CouponCategory;
  amount: string;
  coupon_code: string;
  distribution_point_id: number;
  redeemed_by_member_id: number;
  qr_nonce: string;
  status: string;
  created_at: string;
}

export interface RedemptionHistoryResponse {
  redemptions: CouponRedemption[];
  next_cursor: string;
}

export interface DistributionCenter {
  id: number;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  categories: CouponCategory[];
  operating_hours: string;
  queue_minutes: number;
  stock_status: Record<string, string>;
  province_code: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterHouseholdRequest {
  national_code: string;
  address: string;
  lat: number;
  lng: number;
}

export interface AddMemberRequest {
  national_code: string;
  full_name: string;
  birth_date: string;
  gender: string;
  relationship: string;
  special_flags?: string[];
}

export interface GenerateQRRequest {
  category: string;
  amount: string;
}

export interface DisputeRequest {
  reason: string;
}

export interface MembersResponse {
  members: HouseholdMember[];
}

export interface NearbyDistributionCentersResponse {
  centers: DistributionCenter[];
}

export interface DisputeResponse {
  message: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type CouponCategory =
  | "water"
  | "food"
  | "fuel"
  | "hygiene"
  | "medical"
  | "energy";

export interface PowerBankSwap {
  id: number;
  household_id: number;
  member_id: number;
  status: "pending" | "ready" | "picked_up" | "returned" | "cancelled";
  swap_code: string;
  center_id: number | null;
  picked_up_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PowerBankSwapResponse {
  swap: PowerBankSwap;
  message: string;
}

export interface PowerBankSwapsResponse {
  swaps: PowerBankSwap[];
  active_swap: PowerBankSwap | null;
}
