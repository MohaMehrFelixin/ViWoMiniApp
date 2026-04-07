package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/admin/service"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
	"github.com/viwo-app/mini-coupon/internal/validator"
)

// AdminHandler handles all admin HTTP endpoints.
type AdminHandler struct {
	adminSvc *service.AdminService
	logger   *zap.Logger
}

// NewAdminHandler creates a new admin handler.
func NewAdminHandler(adminSvc *service.AdminService, logger *zap.Logger) *AdminHandler {
	return &AdminHandler{adminSvc: adminSvc, logger: logger}
}

// ─── Auth Endpoints (no session required) ───

// HandleRequestOTP sends an OTP to the admin's phone.
func (h *AdminHandler) HandleRequestOTP(w http.ResponseWriter, r *http.Request) {
	var req adminModel.RequestOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid request body"))
		return
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs))
		return
	}

	maskedPhone, expiresIn, err := h.adminSvc.RequestOTP(r.Context(), req.NationalCode)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "admin_request_otp")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "OTP sent",
		"phone":      maskedPhone,
		"expires_in": expiresIn,
	})
}

// HandleVerifyOTP verifies the OTP and creates a session.
func (h *AdminHandler) HandleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req adminModel.VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid request body"))
		return
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs))
		return
	}

	clientIP := extractIP(r)
	clientUA := r.UserAgent()

	resp, err := h.adminSvc.VerifyOTP(r.Context(), req.NationalCode, req.OTP, clientIP, clientUA)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "admin_verify_otp")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

// HandleLogout destroys the current session.
func (h *AdminHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	session := adminMW.GetAdminSession(r.Context())
	if session == nil {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	if err := h.adminSvc.Logout(r.Context(), session); err != nil {
		h.logger.Error("logout failed", zap.Error(err))
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// HandleGetProfile returns the current admin's profile.
func (h *AdminHandler) HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	adminID := adminMW.GetAdminUserID(r.Context())
	admin, err := h.adminSvc.GetProfile(r.Context(), adminID)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "admin_profile")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, adminModel.AdminProfileResponse{Admin: admin})
}

// ─── Admin User Management ───

// HandleCreateAdmin creates a new admin user.
func (h *AdminHandler) HandleCreateAdmin(w http.ResponseWriter, r *http.Request) {
	var req adminModel.CreateAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid request body"))
		return
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithDetails(errs))
		return
	}

	actorID := adminMW.GetAdminUserID(r.Context())
	actorLevel := adminMW.GetAdminRoleLevel(r.Context())

	admin, err := h.adminSvc.CreateAdmin(r.Context(), &req, actorID, actorLevel)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "admin_create_user")
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, admin)
}

// HandleListAdmins returns a paginated list of admin users.
func (h *AdminHandler) HandleListAdmins(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	admins, total, err := h.adminSvc.ListAdmins(r.Context(), offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "admin_list_users")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, adminModel.AdminListResponse{
		Admins: admins,
		Total:  total,
	})
}

// extractIP delegates to the shared middleware implementation.
func extractIP(r *http.Request) string {
	return adminMW.ExtractIP(r)
}
