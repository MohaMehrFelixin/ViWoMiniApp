export interface Household {
  id: number;
  telegram_user_id: number;
  household_code: string;
  kyc_tier: number;
  phone_number?: string;
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
  full_name: string;
  birth_date: string;
  gender: string;
  mobile: string;
  address: string;
  lat: number;
  lng: number;
  kyc_track_id?: string;
}

export interface SendOTPRequest {
  mobile: string;
  national_code: string;
}

export interface SendOTPResponse {
  track_id: string;
  expires_in: number;
}

export interface VerifyOTPRequest {
  mobile: string;
  national_code: string;
  otp: string;
  track_id: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
  track_id: string;
}

export interface VerifyIdentityRequest {
  national_code: string;
  full_name: string;
  birth_date: string;
  gender: string;
  mobile: string;
  track_id: string;
}

export interface VerifyIdentityResponse {
  shahkar_matched: boolean;
  nid_verified: boolean;
  track_id: string;
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
  category: CouponCategory;
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

export interface Notice {
  id: string;
  text: string;
  text_fa: string;
  type: "info" | "warning" | "promo";
  link?: string;
}

export interface NoticesResponse {
  notices: Notice[];
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

// --- Catalog Items (admin-defined products per category) ---

export interface CatalogUnit {
  code: string;
  name: string;
  name_fa: string;
}

export interface CatalogItemWithUnit {
  id: number;
  category: CouponCategory;
  name: string;
  name_fa: string;
  icon: string;
  scope: "national" | "regional";
  region?: string;
  default_amount: string;
  sort_order: number;
  is_active: boolean;
  unit: CatalogUnit;
}

export interface ItemAllocationView {
  item_id: number;
  category: string;
  name: string;
  name_fa: string;
  icon: string;
  scope: string;
  region?: string;
  unit_code: string;
  unit_name: string;
  unit_name_fa: string;
  allocated_amount: string;
  used_amount: string;
}

export interface CatalogItemsResponse {
  items: CatalogItemWithUnit[];
}

export interface ItemAllocationsResponse {
  national: ItemAllocationView[];
  regional: ItemAllocationView[];
}

// --- Provider / Distributor ---

export interface ProviderProfile {
  id: number;
  name: string;
  name_fa: string;
  type: "distributor" | "service_provider";
  service_type: string; // e.g. "distribution_assistant", "grocery", "bakery"
  status: "pending" | "approved" | "rejected" | "suspended";
  store_address: string;
  store_address_fa: string;
  distribution_point_id: number;
  created_at: string;
}

export interface ProviderSession {
  id: number;
  provider_id: number;
  opened_at: string;
  closed_at: string | null;
  duration_minutes: number;
}

export interface ProviderCategoryStat {
  category: CouponCategory;
  count: number;
  total_amount: string;
}

export interface ProviderStats {
  today: {
    transactions: number;
    by_category: ProviderCategoryStat[];
  };
  total: {
    transactions: number;
    days_worked: number;
    total_hours: number;
    by_category: ProviderCategoryStat[];
  };
  current_session: ProviderSession | null;
}

export interface ProviderProfileResponse {
  provider: ProviderProfile;
}

export interface ProviderSessionResponse {
  session: ProviderSession;
}

export interface ProviderStatsResponse {
  stats: ProviderStats;
}

// --- Power Bank ---

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
