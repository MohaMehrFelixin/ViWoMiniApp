// Admin panel types — mirrors backend admin/model/admin.go

export interface AdminUser {
  id: number;
  national_code: string;
  full_name: string;
  phone: string;
  role_level: number;
  role_title: string;
  province_codes: string[];
  parent_admin_id?: number;
  status: "active" | "suspended" | "deactivated";
  failed_attempts: number;
  locked_until?: string;
  last_login_at?: string;
  last_login_ip?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  session_token: string;
  expires_at: string;
  admin: AdminUser;
}

export interface AuditLog {
  id: number;
  admin_id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  old_value?: unknown;
  new_value?: unknown;
  ip_address: string;
  user_agent: string;
  session_id: string;
  created_at: string;
}

// Entity types from the main coupon system
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
  kyc_status?: string;
  admin_notes?: string;
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

export interface CouponRedemption {
  id: number;
  household_id: number;
  allocation_id: number;
  category: string;
  amount: string;
  coupon_code: string;
  distribution_point_id: number;
  status: string;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  household_id: number;
  telegram_user_id: number;
  category: string;
  priority: string;
  subject: string;
  description: string;
  reference_code?: string;
  status: string;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_households: number;
  active_households: number;
  today_redemptions: number;
  today_redemption_value: string;
  open_disputes: number;
  pending_kyc: number;
  low_stock_centers: number;
  active_swaps: number;
  pending_tickets: number;
  pending_providers: number;
  pending_offerings: number;
}

// Role constants
export const ROLE_TITLES: Record<number, string> = {
  1: "Viewer",
  2: "Field Agent",
  3: "Distribution Mgr",
  4: "KYC Officer",
  5: "Ops Manager",
  6: "Supervisor",
  7: "Sr. Supervisor",
  8: "Regional Director",
  9: "CTO/COO",
  10: "CEO",
};
