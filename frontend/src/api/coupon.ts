import { api } from "./client";
import type {
  Household,
  HouseholdSummaryResponse,
  MembersResponse,
  AllBalancesResponse,
  CategoryBalance,
  GenerateQRResponse,
  CouponRedemption,
  RedemptionHistoryResponse,
  DistributionCenter,
  NearbyDistributionCentersResponse,
  RegisterHouseholdRequest,
  AddMemberRequest,
  GenerateQRRequest,
  DisputeResponse,
  CouponCategory,
  SendOTPRequest,
  SendOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  VerifyIdentityRequest,
  VerifyIdentityResponse,
  NoticesResponse,
  PowerBankSwapResponse,
  PowerBankSwapsResponse,
  CatalogItemsResponse,
  ItemAllocationsResponse,
  ProviderProfileResponse,
  ProviderSessionResponse,
  ProviderStatsResponse,
  SubmitTicketRequest,
  TicketsResponse,
} from "../lib/types";

export async function registerHousehold(
  data: RegisterHouseholdRequest
): Promise<Household> {
  return api.post("household", { json: data }).json<Household>();
}

export async function getHousehold(): Promise<HouseholdSummaryResponse> {
  return api.get("household").json<HouseholdSummaryResponse>();
}

export async function addMember(
  data: AddMemberRequest
): Promise<unknown> {
  return api.post("household/members", { json: data }).json();
}

export async function getMembers(): Promise<MembersResponse> {
  return api.get("household/members").json<MembersResponse>();
}

export async function getBalances(): Promise<AllBalancesResponse> {
  return api.get("balances").json<AllBalancesResponse>();
}

export async function getCategoryBalance(
  category: CouponCategory
): Promise<CategoryBalance> {
  return api.get(`balances/${category}`).json<CategoryBalance>();
}

export async function generateQR(
  data: GenerateQRRequest
): Promise<GenerateQRResponse> {
  return api.post("qr/generate", { json: data }).json<GenerateQRResponse>();
}

export async function redeemCoupon(
  qrData: string,
  distributionPointId: number
): Promise<CouponRedemption> {
  return api
    .post("redeem", {
      json: { qr_data: qrData, distribution_point_id: distributionPointId },
    })
    .json<CouponRedemption>();
}

export async function getRedemptionHistory(
  cursor?: string,
  limit: number = 20,
  category?: CouponCategory
): Promise<RedemptionHistoryResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));
  if (category) params.set("category", category);
  return api
    .get("redemptions", { searchParams: params })
    .json<RedemptionHistoryResponse>();
}

export async function disputeRedemption(
  id: number,
  reason: string
): Promise<DisputeResponse> {
  return api
    .post(`redemptions/${id}/dispute`, { json: { reason } })
    .json<DisputeResponse>();
}

export async function getNearbyCenters(
  lat: number,
  lng: number,
  category?: CouponCategory
): Promise<NearbyDistributionCentersResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  if (category) params.set("category", category);
  return api
    .get("centers/nearby", { searchParams: params })
    .json<NearbyDistributionCentersResponse>();
}

export async function getCenterDetail(
  id: number
): Promise<DistributionCenter> {
  return api.get(`centers/${id}`).json<DistributionCenter>();
}

// Power Bank Swap

export async function requestPowerBankSwap(centerID: number): Promise<PowerBankSwapResponse> {
  return api.post("powerbank/swap", { json: { center_id: centerID } }).json<PowerBankSwapResponse>();
}

export async function getPowerBankSwaps(): Promise<PowerBankSwapsResponse> {
  return api.get("powerbank/swaps").json<PowerBankSwapsResponse>();
}

export async function pickUpPowerBank(swapID: number): Promise<void> {
  await api.post(`powerbank/swaps/${swapID}/pickup`);
}

export async function returnPowerBank(swapID: number): Promise<void> {
  await api.post(`powerbank/swaps/${swapID}/return`);
}

export async function cancelPowerBankSwap(swapID: number): Promise<void> {
  await api.post(`powerbank/swaps/${swapID}/cancel`);
}

// --- Catalog Items ---

export async function getCatalogItems(
  category?: CouponCategory
): Promise<CatalogItemsResponse> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  return api
    .get("catalog/items", { searchParams: params })
    .json<CatalogItemsResponse>();
}

export async function getItemAllocations(
  category?: CouponCategory
): Promise<ItemAllocationsResponse> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  return api
    .get("catalog/allocations", { searchParams: params })
    .json<ItemAllocationsResponse>();
}

// --- Provider / Distributor ---

export async function getProviderProfile(): Promise<ProviderProfileResponse> {
  return api.get("provider/profile").json<ProviderProfileResponse>();
}

export async function openProviderSession(): Promise<ProviderSessionResponse> {
  return api.post("provider/session/open").json<ProviderSessionResponse>();
}

export async function closeProviderSession(): Promise<ProviderSessionResponse> {
  return api.post("provider/session/close").json<ProviderSessionResponse>();
}

export async function getProviderStats(): Promise<ProviderStatsResponse> {
  return api.get("provider/stats").json<ProviderStatsResponse>();
}

// --- Support Tickets ---

export async function getTickets(): Promise<TicketsResponse> {
  return api.get("tickets").json<TicketsResponse>();
}

export async function submitTicket(data: SubmitTicketRequest): Promise<unknown> {
  return api.post("tickets", { json: data }).json();
}

// --- Notices ---

export async function getNotices(): Promise<NoticesResponse> {
  return api.get("notices").json<NoticesResponse>();
}

// --- KYC ---

export async function sendOTP(
  data: SendOTPRequest
): Promise<SendOTPResponse> {
  return api.post("kyc/otp/send", { json: data }).json<SendOTPResponse>();
}

export async function verifyOTP(
  data: VerifyOTPRequest
): Promise<VerifyOTPResponse> {
  return api.post("kyc/otp/verify", { json: data }).json<VerifyOTPResponse>();
}

export async function verifyIdentity(
  data: VerifyIdentityRequest
): Promise<VerifyIdentityResponse> {
  return api
    .post("kyc/verify-identity", { json: data })
    .json<VerifyIdentityResponse>();
}
