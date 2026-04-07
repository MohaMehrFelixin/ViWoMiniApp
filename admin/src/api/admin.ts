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

export async function createAdmin(data: {
  national_code: string;
  full_name: string;
  phone: string;
  role_level: number;
  province_codes?: string[];
}) {
  return api.post("users", { json: data }).json<AdminUser>();
}

// ─── Dashboard ───

export async function getDashboardStats() {
  return api.get("dashboard/stats").json<DashboardStats>();
}

// ─── Households ───

export async function listHouseholds(params: Record<string, string> = {}) {
  return api.get("households", { searchParams: params }).json<{
    households: unknown[];
    total: number;
  }>();
}

export async function getHousehold(id: number) {
  return api.get(`households/${id}`).json<{
    household: unknown;
    members: unknown[];
  }>();
}

export async function suspendHousehold(id: number, reason: string) {
  return api.post(`households/${id}/suspend`, { json: { reason } }).json<{ message: string }>();
}

export async function reactivateHousehold(id: number) {
  return api.post(`households/${id}/reactivate`).json<{ message: string }>();
}

// ─── Redemptions ───

export async function listRedemptions(params: Record<string, string> = {}) {
  return api.get("redemptions", { searchParams: params }).json<{
    redemptions: unknown[];
    total: number;
  }>();
}

export async function resolveDispute(id: number, accepted: boolean, resolution: string) {
  return api.post(`redemptions/${id}/resolve-dispute`, { json: { accepted, resolution } }).json<{ message: string }>();
}

// ─── Distribution Centers ───

export async function listCenters(params: Record<string, string> = {}) {
  return api.get("centers", { searchParams: params }).json<{
    centers: unknown[];
    total: number;
  }>();
}

// ─── Tickets ───

export async function listTickets(params: Record<string, string> = {}) {
  return api.get("tickets", { searchParams: params }).json<{
    tickets: unknown[];
    total: number;
  }>();
}

export async function resolveTicket(id: number) {
  return api.post(`tickets/${id}/resolve`).json<{ message: string }>();
}

// ─── Providers ───

export async function listProviders(params: Record<string, string> = {}) {
  return api.get("providers", { searchParams: params }).json<{
    providers: unknown[];
    total: number;
  }>();
}

export async function approveProvider(id: number) {
  return api.post(`providers/${id}/approve`).json<{ message: string }>();
}

export async function rejectProvider(id: number) {
  return api.post(`providers/${id}/reject`).json<{ message: string }>();
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
