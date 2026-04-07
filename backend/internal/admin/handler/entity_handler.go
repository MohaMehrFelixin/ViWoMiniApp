package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	"github.com/viwo-app/mini-coupon/internal/admin/service"
	couponModel "github.com/viwo-app/mini-coupon/internal/coupon/model"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

// EntityHandler handles admin CRUD for coupon system entities.
type EntityHandler struct {
	entitySvc *service.EntityService
	idGen     *idgen.Generator
	logger    *zap.Logger
}

func NewEntityHandler(entitySvc *service.EntityService, idGen *idgen.Generator, logger *zap.Logger) *EntityHandler {
	return &EntityHandler{entitySvc: entitySvc, idGen: idGen, logger: logger}
}

// ─── Helpers ───

func parsePagination(r *http.Request) (page, limit, offset int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset = (page - 1) * limit
	return
}

func parseID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
}

// ─── Members ───

func (h *EntityHandler) HandleListMembers(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	search := r.URL.Query().Get("search")
	var kycVerified *bool
	if v := r.URL.Query().Get("kyc_verified"); v == "true" {
		t := true
		kycVerified = &t
	} else if v == "false" {
		f := false
		kycVerified = &f
	}
	members, total, err := h.entitySvc.ListMembers(r.Context(), search, kycVerified, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_members")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"members": members, "total": total})
}

func (h *EntityHandler) HandleVerifyMemberKYC(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.VerifyMemberKYC(r.Context(), id, true, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "verify_member_kyc")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "KYC verified"})
}

// HandleBulkVerifyMembers takes { ids: [int64] } and marks them all verified.
func (h *EntityHandler) HandleBulkVerifyMembers(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("ids array required"))
		return
	}
	if len(body.IDs) > 1000 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("max 1000 ids per call"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	count, err := h.entitySvc.BulkVerifyMembers(r.Context(), body.IDs, session)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "bulk_verify_members")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message":        "members verified",
		"verified_count": count,
	})
}

func (h *EntityHandler) HandleDeleteMember(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.SoftDeleteMember(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "delete_member")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "member deleted"})
}

// ─── Allocations ───

func (h *EntityHandler) HandleListAllocations(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	allocations, total, err := h.entitySvc.ListAllocations(r.Context(), status, category, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_allocations")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"allocations": allocations, "total": total})
}

func (h *EntityHandler) HandleAdjustAllocation(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct {
		Amount string `json:"amount"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Amount == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Amount and reason required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.AdjustAllocation(r.Context(), id, body.Amount, body.Reason, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "adjust_allocation")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "allocation adjusted"})
}

func (h *EntityHandler) HandlePauseAllocation(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Reason == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("reason required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.PauseAllocation(r.Context(), id, body.Reason, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "pause_allocation")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "allocation paused"})
}

func (h *EntityHandler) HandleResumeAllocation(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ResumeAllocation(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "resume_allocation")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "allocation resumed"})
}

func (h *EntityHandler) HandleExpireAllocation(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ExpireAllocation(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "expire_allocation")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "allocation expired"})
}

// ─── Catalog Items ───

func (h *EntityHandler) HandleListCatalogItems(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	category := r.URL.Query().Get("category")
	items, total, err := h.entitySvc.ListCatalogItems(r.Context(), category, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_catalog_items")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total})
}

// HandleCreateCatalogItem (FIX B1) — POST /catalog/items now creates instead
// of silently returning the list.
func (h *EntityHandler) HandleCreateCatalogItem(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	// Generate id server-side if not provided.
	if _, ok := body["id"]; !ok {
		newID, err := h.idGen.Generate()
		if err != nil {
			appErrors.WriteJSON(w, appErrors.ErrInternalServer)
			return
		}
		body["id"] = strconv.FormatInt(newID, 10)
	}
	session := adminMW.GetAdminSession(r.Context())
	id, err := h.entitySvc.CreateCatalogItem(r.Context(), body, session)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "create_catalog_item")
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// ─── Power Banks ───

func (h *EntityHandler) HandleListPowerBanks(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")
	swaps, total, err := h.entitySvc.ListPowerBanks(r.Context(), status, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_powerbanks")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"swaps": swaps, "total": total})
}

func (h *EntityHandler) HandleForceSwapStatus(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var body struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("status required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.AdminForceSwapStatus(r.Context(), id, body.Status, body.Notes, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "force_swap_status")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "swap status updated"})
}

// ─── Dashboard ───

func (h *EntityHandler) HandleDashboardStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.entitySvc.GetDashboardStats(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "dashboard_stats")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, stats)
}

// ─── Households ───

func (h *EntityHandler) HandleListHouseholds(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	scope := adminMW.GetAdminScope(r.Context())

	households, total, err := h.entitySvc.ListHouseholds(r.Context(), search, status, scope, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_households")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"households": households, "total": total})
}

func (h *EntityHandler) HandleGetHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	scope := adminMW.GetAdminScope(r.Context())
	household, members, err := h.entitySvc.GetHouseholdDetail(r.Context(), id, scope)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "get_household")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"household": household, "members": members})
}

func (h *EntityHandler) HandleSuspendHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Reason == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("reason required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.SuspendHousehold(r.Context(), id, body.Reason, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "suspend_household")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "household suspended"})
}

func (h *EntityHandler) HandleReactivateHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ReactivateHousehold(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "reactivate_household")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "household reactivated"})
}

func (h *EntityHandler) HandleUpdateHouseholdNotes(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var body struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.UpdateHouseholdNotes(r.Context(), id, body.Notes, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_household_notes")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "notes updated"})
}

func (h *EntityHandler) HandleUpdateHouseholdKYCStatus(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var body struct {
		KYCStatus string `json:"kyc_status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.KYCStatus == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("kyc_status required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.UpdateHouseholdKYCStatus(r.Context(), id, body.KYCStatus, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_household_kyc_status")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "kyc_status updated"})
}

// ─── Redemptions ───

func (h *EntityHandler) HandleListRedemptions(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")

	redemptions, total, err := h.entitySvc.ListRedemptions(r.Context(), status, category, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_redemptions")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"redemptions": redemptions, "total": total})
}

func (h *EntityHandler) HandleResolveDispute(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct {
		Accepted   bool   `json:"accepted"`
		Resolution string `json:"resolution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Resolution == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("resolution required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ResolveDispute(r.Context(), id, body.Accepted, body.Resolution, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "resolve_dispute")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "dispute resolved"})
}

func (h *EntityHandler) HandleReverseRedemption(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Reason == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("reason required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ReverseRedemption(r.Context(), id, body.Reason, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "reverse_redemption")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "redemption reversed"})
}

// ─── Distribution Centers ───

func (h *EntityHandler) HandleListCenters(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")
	scope := adminMW.GetAdminScope(r.Context())

	centers, total, err := h.entitySvc.ListCenters(r.Context(), status, scope, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_centers")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"centers": centers, "total": total})
}

func (h *EntityHandler) HandleGetCenter(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	c, err := h.entitySvc.GetCenter(r.Context(), id)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "get_center")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, c)
}

func (h *EntityHandler) HandleCreateCenter(w http.ResponseWriter, r *http.Request) {
	var c couponModel.DistributionCenter
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	if c.Name == "" || c.Address == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("name and address required"))
		return
	}
	id, err := h.idGen.Generate()
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrInternalServer)
		return
	}
	c.ID = id
	if c.Status == "" {
		c.Status = "open"
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.CreateCenter(r.Context(), &c, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "create_center")
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, c)
}

func (h *EntityHandler) HandleUpdateCenter(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var fields map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	// Whitelist allowed fields to prevent arbitrary column writes.
	allowed := map[string]bool{
		"name": true, "type": true, "address": true, "lat": true, "lng": true,
		"operating_hours": true, "queue_minutes": true, "status": true, "province_code": true,
	}
	filtered := map[string]interface{}{}
	for k, v := range fields {
		if allowed[k] {
			filtered[k] = v
		}
	}
	if len(filtered) == 0 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("no editable fields supplied"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.UpdateCenter(r.Context(), id, filtered, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_center")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "center updated"})
}

func (h *EntityHandler) HandleUpdateCenterStock(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var stock map[string]string
	if err := json.NewDecoder(r.Body).Decode(&stock); err != nil || len(stock) == 0 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("stock map required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.UpdateCenterStock(r.Context(), id, stock, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_center_stock")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "stock updated"})
}

func (h *EntityHandler) HandleDeactivateCenter(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.DeactivateCenter(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "deactivate_center")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "center deactivated"})
}

// ─── Support Tickets ───

func (h *EntityHandler) HandleListTickets(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")

	tickets, total, err := h.entitySvc.ListTickets(r.Context(), status, priority, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_tickets")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"tickets": tickets, "total": total})
}

func (h *EntityHandler) HandleResolveTicket(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ResolveTicket(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "resolve_ticket")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "ticket resolved"})
}

// ─── Volunteers ───

func (h *EntityHandler) HandleListVolunteers(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")

	volunteers, total, err := h.entitySvc.ListVolunteers(r.Context(), status, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_volunteers")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"volunteers": volunteers, "total": total})
}

func (h *EntityHandler) HandleApproveVolunteer(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ApproveVolunteer(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "approve_volunteer")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "volunteer approved"})
}

func (h *EntityHandler) HandleRejectVolunteer(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.RejectVolunteer(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "reject_volunteer")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "volunteer rejected"})
}

// ─── Providers ───

func (h *EntityHandler) HandleListProviders(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")

	providers, total, err := h.entitySvc.ListProviders(r.Context(), status, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_providers")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"providers": providers, "total": total})
}

func (h *EntityHandler) HandleApproveProvider(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ApproveProvider(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "approve_provider")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "provider approved"})
}

func (h *EntityHandler) HandleRejectProvider(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.RejectProvider(r.Context(), id, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "reject_provider")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "provider rejected"})
}
