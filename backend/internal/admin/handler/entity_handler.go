package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	"github.com/viwo-app/mini-coupon/internal/admin/service"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
)

// EntityHandler handles admin CRUD for coupon system entities.
type EntityHandler struct {
	entitySvc *service.EntityService
	logger    *zap.Logger
}

func NewEntityHandler(entitySvc *service.EntityService, logger *zap.Logger) *EntityHandler {
	return &EntityHandler{entitySvc: entitySvc, logger: logger}
}

// ─── Pagination helper ───

func parsePagination(r *http.Request) (page, limit, offset int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 25 }
	offset = (page - 1) * limit
	return
}

// ─── Members ───

func (h *EntityHandler) HandleListMembers(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	search := r.URL.Query().Get("search")
	var kycVerified *bool
	if v := r.URL.Query().Get("kyc_verified"); v == "true" {
		t := true; kycVerified = &t
	} else if v == "false" {
		f := false; kycVerified = &f
	}
	members, total, err := h.entitySvc.ListMembers(r.Context(), search, kycVerified, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_members")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"members": members, "total": total})
}

func (h *EntityHandler) HandleVerifyMemberKYC(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct{ Amount string `json:"amount"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Amount == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Amount required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.AdjustAllocation(r.Context(), id, body.Amount, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "adjust_allocation")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "allocation adjusted"})
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

	households, total, err := h.entitySvc.ListHouseholds(r.Context(), search, status, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_households")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"households": households, "total": total})
}

func (h *EntityHandler) HandleGetHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	household, members, err := h.entitySvc.GetHouseholdDetail(r.Context(), id)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "get_household")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"household": household, "members": members})
}

func (h *EntityHandler) HandleSuspendHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct{ Reason string `json:"reason"` }
	_ = json.NewDecoder(r.Body).Decode(&body)

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.SuspendHousehold(r.Context(), id, body.Reason, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "suspend_household")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "household suspended"})
}

func (h *EntityHandler) HandleReactivateHousehold(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid ID"))
		return
	}
	var body struct {
		Accepted   bool   `json:"accepted"`
		Resolution string `json:"resolution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entitySvc.ResolveDispute(r.Context(), id, body.Accepted, body.Resolution, session); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "resolve_dispute")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "dispute resolved"})
}

// ─── Distribution Centers ───

func (h *EntityHandler) HandleListCenters(w http.ResponseWriter, r *http.Request) {
	_, limit, offset := parsePagination(r)
	status := r.URL.Query().Get("status")

	centers, total, err := h.entitySvc.ListCenters(r.Context(), status, offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_centers")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"centers": centers, "total": total})
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
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
