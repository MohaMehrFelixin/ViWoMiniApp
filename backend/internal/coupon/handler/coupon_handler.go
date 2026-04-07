package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
	"github.com/viwo-app/mini-coupon/internal/middleware"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/service"
	"github.com/viwo-app/mini-coupon/internal/validator"
)

type CouponHandler struct {
	householdSvc    *service.HouseholdService
	allocationSvc   *service.AllocationService
	redemptionSvc   *service.RedemptionService
	distributionSvc *service.DistributionService
	powerBankSvc    *service.PowerBankService
	kycSvc          *service.KYCService
	rdb             *redis.Client
	logger          *zap.Logger
}

func NewCouponHandler(h *service.HouseholdService, a *service.AllocationService, r *service.RedemptionService, d *service.DistributionService, pb *service.PowerBankService, kyc *service.KYCService, rdb *redis.Client, l *zap.Logger) *CouponHandler {
	return &CouponHandler{householdSvc: h, allocationSvc: a, redemptionSvc: r, distributionSvc: d, powerBankSvc: pb, kycSvc: kyc, rdb: rdb, logger: l}
}

func (h *CouponHandler) requireTG(w http.ResponseWriter, r *http.Request) int64 {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 { appErrors.WriteJSON(w, appErrors.ErrUnauthorized) }
	return uid
}

func (h *CouponHandler) requireHousehold(w http.ResponseWriter, r *http.Request, uid int64, op string) *model.HouseholdSummaryResponse {
	s, err := h.householdSvc.GetHouseholdSummary(r.Context(), uid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, op); return nil }
	return s
}

func (h *CouponHandler) HandleRegisterHousehold(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.RegisterHouseholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	req.NationalCode = model.NormalizePersianDigits(req.NationalCode)
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	hh, err := h.householdSvc.RegisterHousehold(r.Context(), uid, req)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "register"); return }
	httputil.WriteJSON(w, http.StatusCreated, hh)
}

func (h *CouponHandler) HandleAddMember(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	req.NationalCode = model.NormalizePersianDigits(req.NationalCode)
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	s := h.requireHousehold(w, r, uid, "add_member"); if s == nil { return }
	m, err := h.householdSvc.AddMember(r.Context(), s.Household.ID, req)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "add_member"); return }
	httputil.WriteJSON(w, http.StatusCreated, m)
}

func (h *CouponHandler) HandleGetHousehold(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "get_household"); if s == nil { return }
	httputil.WriteJSON(w, http.StatusOK, s)
}

func (h *CouponHandler) HandleGetMembers(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	members, err := h.householdSvc.GetMembers(r.Context(), uid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "get_members"); return }
	httputil.WriteJSON(w, http.StatusOK, model.MembersResponse{Members: members})
}

func (h *CouponHandler) HandleGetBalances(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "get_balances"); if s == nil { return }
	b, err := h.allocationSvc.GetBalances(r.Context(), s.Household.ID)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "get_balances"); return }
	httputil.WriteJSON(w, http.StatusOK, b)
}

func (h *CouponHandler) HandleGetCategoryBalance(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	cat := model.CouponCategory(strings.ToLower(chi.URLParam(r, "category")))
	if !cat.IsValid() { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid category")); return }
	s := h.requireHousehold(w, r, uid, "cat_balance"); if s == nil { return }
	b, err := h.allocationSvc.GetCategoryBalance(r.Context(), s.Household.ID, cat)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "cat_balance"); return }
	httputil.WriteJSON(w, http.StatusOK, b)
}

func (h *CouponHandler) HandleGenerateQR(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.GenerateQRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	s := h.requireHousehold(w, r, uid, "generate_qr"); if s == nil { return }
	cat := model.CouponCategory(strings.ToLower(req.Category))
	if !cat.IsValid() { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid category")); return }
	qr, err := h.redemptionSvc.GenerateQR(r.Context(), s.Household.ID, cat, req.Amount)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "generate_qr"); return }
	qrJSON, _ := json.Marshal(qr)
	httputil.WriteJSON(w, http.StatusOK, model.GenerateQRResponse{QRData: string(qrJSON), Payload: qr})
}

func (h *CouponHandler) HandleRedeemCoupon(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "redeem"); if s == nil { return }
	var req model.RedeemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	var qr model.QRPayload
	if err := json.Unmarshal([]byte(req.QRData), &qr); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid QR")); return }
	if qr.HouseholdID != s.Household.ID { appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("QR does not belong to this household")); return }
	rd, err := h.redemptionSvc.VerifyAndRedeem(r.Context(), qr, req.DistributionPointID)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "redeem"); return }
	httputil.WriteJSON(w, http.StatusCreated, rd)
}

func (h *CouponHandler) HandleGetRedemptionHistory(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "history"); if s == nil { return }
	cursor := r.URL.Query().Get("cursor")
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" { if p, err := strconv.Atoi(l); err == nil && p > 0 && p <= 100 { limit = p } }
	var cat *model.CouponCategory
	if c := r.URL.Query().Get("category"); c != "" {
		cc := model.CouponCategory(strings.ToLower(c))
		if !cc.IsValid() { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid category")); return }
		cat = &cc
	}
	rds, nc, err := h.redemptionSvc.GetHistory(r.Context(), s.Household.ID, cat, cursor, limit)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "history"); return }
	httputil.WriteJSON(w, http.StatusOK, model.RedemptionHistoryResponse{Redemptions: rds, NextCursor: nc})
}

func (h *CouponHandler) HandleDisputeRedemption(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	rid, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID")); return }
	var req model.DisputeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	s := h.requireHousehold(w, r, uid, "dispute"); if s == nil { return }
	if err := h.redemptionSvc.DisputeRedemption(r.Context(), rid, s.Household.ID, req.Reason); err != nil { httputil.HandleServiceError(w, err, h.logger, "dispute"); return }
	httputil.WriteJSON(w, http.StatusOK, model.DisputeResponse{Message: "Dispute submitted"})
}

func (h *CouponHandler) HandleGetNearbyCenters(w http.ResponseWriter, r *http.Request) {
	lat, err := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid lat")); return }
	if lat < -90 || lat > 90 { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("lat must be between -90 and 90")); return }
	lng, err := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid lng")); return }
	if lng < -180 || lng > 180 { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("lng must be between -180 and 180")); return }
	var cat *model.CouponCategory
	if c := r.URL.Query().Get("category"); c != "" {
		cc := model.CouponCategory(strings.ToLower(c))
		if !cc.IsValid() { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid category")); return }
		cat = &cc
	}
	centers, err := h.distributionSvc.GetNearbyWithStock(r.Context(), lat, lng, cat)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "nearby"); return }
	httputil.WriteJSON(w, http.StatusOK, model.NearbyDistributionCentersResponse{Centers: centers})
}

func (h *CouponHandler) HandleGetCenter(w http.ResponseWriter, r *http.Request) {
	cid, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID")); return }
	c, err := h.distributionSvc.GetDetail(r.Context(), cid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "get_center"); return }
	httputil.WriteJSON(w, http.StatusOK, c)
}

// Power Bank Swap handlers.

func (h *CouponHandler) HandleRequestSwap(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "request_swap"); if s == nil { return }
	var req model.RequestSwapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	swap, err := h.powerBankSvc.RequestSwap(r.Context(), s.Household.ID, uid, req.CenterID)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "request_swap"); return }
	httputil.WriteJSON(w, http.StatusCreated, model.PowerBankSwapResponse{Swap: swap, Message: "Power bank swap requested"})
}

func (h *CouponHandler) HandleGetSwaps(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	s := h.requireHousehold(w, r, uid, "get_swaps"); if s == nil { return }
	res, err := h.powerBankSvc.GetSwaps(r.Context(), s.Household.ID)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "get_swaps"); return }
	httputil.WriteJSON(w, http.StatusOK, res)
}

func (h *CouponHandler) HandlePickUpSwap(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	swapID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID")); return }
	s := h.requireHousehold(w, r, uid, "pickup_swap"); if s == nil { return }
	if err := h.powerBankSvc.PickUp(r.Context(), swapID, s.Household.ID); err != nil { httputil.HandleServiceError(w, err, h.logger, "pickup_swap"); return }
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "Power bank picked up"})
}

func (h *CouponHandler) HandleReturnSwap(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	swapID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID")); return }
	s := h.requireHousehold(w, r, uid, "return_swap"); if s == nil { return }
	if err := h.powerBankSvc.ReturnBank(r.Context(), swapID, s.Household.ID); err != nil { httputil.HandleServiceError(w, err, h.logger, "return_swap"); return }
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "Power bank returned"})
}

func (h *CouponHandler) HandleCancelSwap(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	swapID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID")); return }
	s := h.requireHousehold(w, r, uid, "cancel_swap"); if s == nil { return }
	if err := h.powerBankSvc.CancelSwap(r.Context(), swapID, s.Household.ID); err != nil { httputil.HandleServiceError(w, err, h.logger, "cancel_swap"); return }
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "Swap cancelled"})
}

// --- Notices ---

func (h *CouponHandler) HandleGetNotices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	data, err := h.rdb.Get(ctx, "app:notices").Bytes()
	if err != nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"notices": []interface{}{}})
		return
	}

	// Bug B2 fix: filter out inactive notices before returning. Previously
	// the public endpoint returned the full array including notices the
	// admin had toggled inactive, which made the toggle meaningless.
	var notices []map[string]interface{}
	if err := json.Unmarshal(data, &notices); err != nil {
		h.logger.Warn("invalid notices JSON in Redis", zap.Error(err))
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"notices": []interface{}{}})
		return
	}

	active := make([]map[string]interface{}, 0, len(notices))
	for _, n := range notices {
		// Default to active=true for legacy notices that don't have the field.
		if a, ok := n["active"].(bool); ok && !a {
			continue
		}
		active = append(active, n)
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"notices": active})
}

// --- KYC Handlers ---

func (h *CouponHandler) HandleSendOTP(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.SendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	req.NationalCode = model.NormalizePersianDigits(req.NationalCode)
	req.Mobile = model.NormalizePersianDigits(req.Mobile)
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	result, err := h.kycSvc.SendOTP(r.Context(), req.Mobile, req.NationalCode, uid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "send_otp"); return }
	httputil.WriteJSON(w, http.StatusOK, result)
}

func (h *CouponHandler) HandleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	req.NationalCode = model.NormalizePersianDigits(req.NationalCode)
	req.Mobile = model.NormalizePersianDigits(req.Mobile)
	req.OTP = model.NormalizePersianDigits(req.OTP)
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	result, err := h.kycSvc.VerifyOTP(r.Context(), req.Mobile, req.NationalCode, req.OTP, req.TrackID, uid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "verify_otp"); return }
	httputil.WriteJSON(w, http.StatusOK, result)
}

func (h *CouponHandler) HandleVerifyIdentity(w http.ResponseWriter, r *http.Request) {
	uid := h.requireTG(w, r); if uid == 0 { return }
	var req model.VerifyIdentityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid body")); return }
	req.NationalCode = model.NormalizePersianDigits(req.NationalCode)
	req.Mobile = model.NormalizePersianDigits(req.Mobile)
	if errs := validator.ValidateStruct(req); errs != nil { appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs)); return }
	result, err := h.kycSvc.VerifyIdentity(r.Context(), req.NationalCode, req.FullName, req.BirthDate, req.Gender, req.Mobile, req.TrackID, uid)
	if err != nil { httputil.HandleServiceError(w, err, h.logger, "verify_identity"); return }
	httputil.WriteJSON(w, http.StatusOK, result)
}
