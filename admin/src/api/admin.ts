import { api } from "./client";
import type { AdminUser, AdminSession, AuditLog, DashboardStats } from "../lib/types";

// ─── Auth ───

export async function requestOTP(national_code: string) {
  return api.post("auth/request-otp", { json: { national_code } }).json<{
    message: string;
    phone: string;
    expires_in: number;
  }>();
}

export async function verifyOTP(national_code: string, otp: string) {
  return api.post("auth/verify-otp", { json: { national_code, otp } }).json<AdminSession>();
}

export async function logout() {
  return api.post("auth/logout").json<{ message: string }>();
}

export async function getProfile() {
  return api.get("auth/me").json<{ admin: AdminUser }>();
}

// ─── Admin Users ───

export async function listAdmins(page = 1, limit = 25) {
  return api.get("users", { searchParams: { page, limit } }).json<{
    admins: AdminUser[];
    total: number;
  }>();
}

export async function getAdmin(id: number) {
  return api.get(`users/${id}`).json<AdminUser>();
}

export async function createAdmin(data: {
  national_code: string;
  full_name: string;
  phone: string;
  role_level: number;
  province_codes?: string[];
}) {
  return api.post("users", { json: data }).json<AdminUser>();
}

export async function updateAdmin(id: number, data: {
  full_name?: string;
  phone?: string;
  role_level?: number;
  province_codes?: string[];
  status?: "active" | "suspended" | "deactivated";
}) {
  return api.put(`users/${id}`, { json: data }).json<AdminUser>();
}

export async function deactivateAdmin(id: number) {
  return api.delete(`users/${id}`).json<{ message: string }>();
}

export async function listSubordinates(id: number) {
  return api.get(`users/${id}/subordinates`).json<{ admins: AdminUser[] }>();
}

// ─── Dashboard ───

export async function getDashboardStats() {
  return api.get("dashboard/stats").json<DashboardStats>();
}

// ─── Households ───

export interface HouseholdRow {
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
  kyc_status?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MemberRow {
  id: number;
  household_id: number;
  national_code: string;
  full_name: string;
  birth_date?: string;
  gender: string;
  relationship: string;
  age_group: string;
  special_flags: string[];
  kyc_verified: boolean;
  created_at: string;
}

export async function listHouseholds(params: Record<string, string> = {}) {
  return api.get("households", { searchParams: params }).json<{
    households: HouseholdRow[];
    total: number;
  }>();
}

export async function getHousehold(id: number) {
  return api.get(`households/${id}`).json<{
    household: HouseholdRow;
    members: MemberRow[];
  }>();
}

export async function suspendHousehold(id: number, reason: string) {
  return api.post(`households/${id}/suspend`, { json: { reason } }).json<{ message: string }>();
}

export async function reactivateHousehold(id: number) {
  return api.post(`households/${id}/reactivate`).json<{ message: string }>();
}

export async function updateHouseholdNotes(id: number, notes: string) {
  return api.put(`households/${id}/notes`, { json: { notes } }).json<{ message: string }>();
}

export async function updateHouseholdKYCStatus(id: number, kyc_status: string) {
  return api.put(`households/${id}/kyc-status`, { json: { kyc_status } }).json<{ message: string }>();
}

// ─── Members ───

export async function listMembers(params: Record<string, string> = {}) {
  return api.get("members", { searchParams: params }).json<{
    members: MemberRow[];
    total: number;
  }>();
}

export async function verifyMemberKYC(id: number) {
  return api.post(`members/${id}/verify-kyc`).json<{ message: string }>();
}

export async function bulkVerifyMembers(ids: number[]) {
  return api.post("members/bulk-verify", { json: { ids } }).json<{
    message: string;
    verified_count: number;
  }>();
}

export async function deleteMember(id: number) {
  return api.delete(`members/${id}`).json<{ message: string }>();
}

// ─── Allocations ───

export interface AllocationRow {
  id: number;
  household_id: number;
  category: string;
  total_amount: string;
  used_amount: string;
  remaining_amount: string;
  current_week: number;
  status: string;
  created_at: string;
}

export async function listAllocations(params: Record<string, string> = {}) {
  return api.get("allocations", { searchParams: params }).json<{
    allocations: AllocationRow[];
    total: number;
  }>();
}

export async function adjustAllocation(id: number, amount: string, reason: string) {
  return api.put(`allocations/${id}/adjust`, { json: { amount, reason } }).json<{ message: string }>();
}

export async function pauseAllocation(id: number, reason: string) {
  return api.post(`allocations/${id}/pause`, { json: { reason } }).json<{ message: string }>();
}

export async function resumeAllocation(id: number) {
  return api.post(`allocations/${id}/resume`).json<{ message: string }>();
}

export async function expireAllocation(id: number) {
  return api.post(`allocations/${id}/expire`).json<{ message: string }>();
}

// ─── Redemptions ───

export interface RedemptionRow {
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

export async function listRedemptions(params: Record<string, string> = {}) {
  return api.get("redemptions", { searchParams: params }).json<{
    redemptions: RedemptionRow[];
    total: number;
  }>();
}

export async function resolveDispute(id: number, accepted: boolean, resolution: string) {
  return api
    .post(`redemptions/${id}/resolve-dispute`, { json: { accepted, resolution } })
    .json<{ message: string }>();
}

export async function reverseRedemption(id: number, reason: string) {
  return api.post(`redemptions/${id}/reverse`, { json: { reason } }).json<{ message: string }>();
}

// ─── Distribution Centers ───

export interface CenterRow {
  id: number;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  categories: string[];
  operating_hours: string;
  queue_minutes: number;
  stock_status: Record<string, string>;
  province_code: string;
  status: string;
}

export async function listCenters(params: Record<string, string> = {}) {
  return api.get("centers", { searchParams: params }).json<{
    centers: CenterRow[];
    total: number;
  }>();
}

export async function getCenter(id: number) {
  return api.get(`centers/${id}`).json<CenterRow>();
}

export async function createCenter(data: Partial<CenterRow>) {
  return api.post("centers", { json: data }).json<CenterRow>();
}

export async function updateCenter(id: number, data: Partial<CenterRow>) {
  return api.put(`centers/${id}`, { json: data }).json<{ message: string }>();
}

export async function updateCenterStock(id: number, stock: Record<string, string>) {
  return api.put(`centers/${id}/stock`, { json: stock }).json<{ message: string }>();
}

export async function deactivateCenter(id: number) {
  return api.delete(`centers/${id}`).json<{ message: string }>();
}

// ─── Power Banks ───

export interface SwapRow {
  id: number;
  household_id: number;
  status: string;
  swap_code: string;
  created_at: string;
  updated_at: string;
}

export async function listPowerBanks(params: Record<string, string> = {}) {
  return api.get("powerbanks", { searchParams: params }).json<{
    swaps: SwapRow[];
    total: number;
  }>();
}

export async function forceSwapStatus(id: number, status: string, notes: string) {
  return api.put(`powerbanks/${id}/status`, { json: { status, notes } }).json<{ message: string }>();
}

// ─── Tickets ───

export interface TicketRow {
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

export async function listTickets(params: Record<string, string> = {}) {
  return api.get("tickets", { searchParams: params }).json<{
    tickets: TicketRow[];
    total: number;
  }>();
}

export async function resolveTicket(id: number) {
  return api.post(`tickets/${id}/resolve`).json<{ message: string }>();
}

// ─── Providers ───

export interface ProviderRow {
  id: number;
  name: string;
  name_fa?: string;
  type: string;
  service_type: string;
  status: string;
  store_address: string;
  created_at: string;
}

export async function listProviders(params: Record<string, string> = {}) {
  return api.get("providers", { searchParams: params }).json<{
    providers: ProviderRow[];
    total: number;
  }>();
}

export async function approveProvider(id: number) {
  return api.post(`providers/${id}/approve`).json<{ message: string }>();
}

export async function rejectProvider(id: number) {
  return api.post(`providers/${id}/reject`).json<{ message: string }>();
}

// ─── Volunteers ───

export interface VolunteerRow {
  id: number;
  full_name: string;
  specialty?: string;
  status: string;
  created_at: string;
}

export async function listVolunteers(params: Record<string, string> = {}) {
  return api.get("volunteers", { searchParams: params }).json<{
    volunteers: VolunteerRow[];
    total: number;
  }>();
}

export async function approveVolunteer(id: number) {
  return api.post(`volunteers/${id}/approve`).json<{ message: string }>();
}

export async function rejectVolunteer(id: number) {
  return api.post(`volunteers/${id}/reject`).json<{ message: string }>();
}

// ─── Catalog ───

export interface CatalogRow {
  id: number;
  category: string;
  name: string;
  name_fa: string;
  icon: string;
  scope: string;
  region?: string;
  default_amount: number;
  unit_code: string;
  unit_name: string;
}

export async function listCatalogItems(params: Record<string, string> = {}) {
  return api.get("catalog/items", { searchParams: params }).json<{
    items: CatalogRow[];
    total: number;
  }>();
}

export async function createCatalogItem(data: {
  category: string;
  name: string;
  name_fa: string;
  icon: string;
  scope: string;
  region?: string;
  default_amount: number;
  unit_code: string;
}) {
  return api.post("catalog/items", { json: data }).json<{ id: number }>();
}

// ─── Notices ───

export interface Notice {
  id: string;
  text: string;
  text_fa: string;
  type: "info" | "warning" | "promo";
  link?: string;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export async function listNotices() {
  return api.get("notices").json<{ notices: Notice[] }>();
}

export async function createNotice(data: Partial<Notice>) {
  return api.post("notices", { json: data }).json<Notice>();
}

export async function updateNotice(id: string, data: Partial<Notice>) {
  return api.put(`notices/${id}`, { json: data }).json<Notice>();
}

export async function deleteNotice(id: string) {
  return api.delete(`notices/${id}`).json<{ message: string }>();
}

export async function reorderNotices(ids: string[]) {
  return api.put("notices/reorder", { json: { ids } }).json<{ message: string }>();
}

// ─── Settings ───

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export async function listSettings() {
  return api.get("settings").json<{ settings: Setting[] }>();
}

export async function updateSetting(key: string, value: unknown) {
  return api.put(`settings/${key}`, { json: { value } }).json<{ message: string }>();
}

export async function getFraudIndicators() {
  return api.get("dashboard/fraud").json<{
    alerts: Array<{ type: string; severity: string; message: string }>;
  }>();
}

// ─── Analytics ───

export async function getRedemptionsByDay(days = 30) {
  return api.get("dashboard/redemptions-by-day", { searchParams: { days } }).json<{
    data: Array<{ day: string; category: string; count: number; total: number }>;
  }>();
}

export async function getCategoryDistribution() {
  return api.get("dashboard/category-distribution").json<{
    data: Array<{ category: string; count: number; total: number }>;
  }>();
}

export async function getCenterUtilization() {
  return api.get("dashboard/center-utilization").json<{
    data: Array<{ name: string; status: string; redemptions: number }>;
  }>();
}

// ─── Exports ───

export function exportHouseholdsURL() {
  return "/api/v1/admin/export/households";
}

export function exportRedemptionsURL() {
  return "/api/v1/admin/export/redemptions";
}

// ─── Audit ───

export async function listAuditLogs(params: Record<string, string> = {}) {
  return api.get("audit", { searchParams: params }).json<{
    logs: AuditLog[];
    total: number;
  }>();
}
