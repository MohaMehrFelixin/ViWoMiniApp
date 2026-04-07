package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/middleware"
)

// RegisterAdminRoutes mounts all admin API routes under /api/v1/admin.
// GetAdminStatusFunc is the signature for checking admin active status from the DB.
type GetAdminStatusFunc func(ctx context.Context, adminID int64) (string, error)

func RegisterAdminRoutes(
	r chi.Router,
	h *AdminHandler,
	e *EntityHandler,
	a *AnalyticsHandler,
	s *SettingsHandler,
	sessionAuth func(http.Handler) http.Handler,
	getAdminStatusFn GetAdminStatusFunc,
	rdb *redis.Client,
) {
	// ── Public auth endpoints (rate-limited, no session required) ──
	authRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 1, Burst: 3})
	r.With(authRL).Post("/auth/request-otp", h.HandleRequestOTP)
	r.With(authRL).Post("/auth/verify-otp", h.HandleVerifyOTP)

	// ── Protected endpoints (session required + active check) ──
	r.Group(func(r chi.Router) {
		r.Use(sessionAuth)

		// Check admin is still active on EVERY request (catches suspended-while-logged-in).
		if getAdminStatusFn != nil {
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					adminID := adminMW.GetAdminUserID(req.Context())
					status, err := getAdminStatusFn(req.Context(), adminID)
					if err != nil || status != "active" {
						appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("Account is suspended or deactivated"))
						return
					}
					next.ServeHTTP(w, req)
				})
			})
		}

		// Auth
		r.Post("/auth/logout", h.HandleLogout)
		r.Get("/auth/me", h.HandleGetProfile)

		// Admin user management (L6+ can create subordinates)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Post("/users", h.HandleCreateAdmin)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Get("/users", h.HandleListAdmins)

		// ── Entity management (real handlers) ──

		// Dashboard + Analytics (all roles can view)
		r.Get("/dashboard/stats", e.HandleDashboardStats)
		r.Get("/dashboard/redemptions-by-day", a.HandleRedemptionsByDay)
		r.Get("/dashboard/category-distribution", a.HandleCategoryDistribution)
		r.Get("/dashboard/center-utilization", a.HandleCenterUtilization)

		// CSV Exports (L1+ can export)
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/export/households", a.HandleExportHouseholds)
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/export/redemptions", a.HandleExportRedemptions)

		// Households (L2+ can read, L7+ can suspend)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/households", e.HandleListHouseholds)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/households/{id}", e.HandleGetHousehold)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/households/{id}/suspend", e.HandleSuspendHousehold)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/households/{id}/reactivate", e.HandleReactivateHousehold)

		// Redemptions (L1+ can read, L3+ can resolve disputes)
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/redemptions", e.HandleListRedemptions)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Post("/redemptions/{id}/resolve-dispute", e.HandleResolveDispute)

		// Distribution Centers (L2+ can read, L3+ can manage)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/centers", e.HandleListCenters)

		// Providers (L3+ can read, L7+ can approve/reject)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Get("/providers", e.HandleListProviders)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/providers/{id}/approve", e.HandleApproveProvider)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/providers/{id}/reject", e.HandleRejectProvider)

		// Support Tickets (L2+ can read, L5+ can resolve)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/tickets", e.HandleListTickets)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/tickets/{id}/resolve", e.HandleResolveTicket)

		// ── Stubs (Phase 3+) ──

		// Members
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/members", e.HandleListMembers)
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Post("/members/{id}/verify-kyc", e.HandleVerifyMemberKYC)

		// Allocations
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/allocations", e.HandleListAllocations)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Put("/allocations/{id}/adjust", e.HandleAdjustAllocation)

		// Volunteers (L4+ can read, L7+ can approve/reject)
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Get("/volunteers", e.HandleListVolunteers)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/volunteers/{id}/approve", e.HandleApproveVolunteer)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/volunteers/{id}/reject", e.HandleRejectVolunteer)

		// Catalog Items
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/catalog/items", e.HandleListCatalogItems)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/catalog/items", e.HandleListCatalogItems)

		// Notices (L5+ manage)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Get("/notices", s.HandleListNotices)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/notices", s.HandleSaveNotices)

		// System Settings (L1+ read, L9+ write)
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/settings", s.HandleListSettings)
		r.With(adminMW.RequireRole(adminModel.RoleCTO)).Put("/settings/{key}", s.HandleUpdateSetting)

		// Fraud Detection (L5+ view)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Get("/dashboard/fraud", s.HandleFraudIndicators)

		// Power Banks
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Get("/powerbanks", e.HandleListPowerBanks)
	})
}

// placeholder returns a handler that responds with a "not yet implemented" message.
// Used for route stubs during phased development.
func placeholder(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotImplemented)
		_, _ = w.Write([]byte(`{"error":{"code":"NOT_IMPLEMENTED","message":"` + endpoint + ` is not yet implemented"}}`))
	}
}
