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

// GetAdminStatusFunc returns the active/suspended/deactivated state of an
// admin user. Used by the per-request "still active" check below.
type GetAdminStatusFunc func(ctx context.Context, adminID int64) (string, error)

// RegisterAdminRoutes mounts every admin API route under /api/v1/admin.
//
// Authorization model:
//   - Public auth endpoints are rate-limited but require no session.
//   - All other routes go through SessionAuth + a per-request "still active"
//     check (catches admins suspended after they logged in).
//   - Each individual route gates by RoleLevel via RequireRole.
//   - Province scoping is enforced inside the service layer for list reads
//     (the session's province codes are read from context and passed to the
//     repo's WHERE clause). Single-entity reads also check scope server-side.
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

	// ── Protected endpoints ──
	r.Group(func(r chi.Router) {
		r.Use(sessionAuth)

		// Per-request "still active" check.
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

		// ── Auth ──
		r.Post("/auth/logout", h.HandleLogout)
		r.Get("/auth/me", h.HandleGetProfile)

		// ── Admin user management (L6+ only) ──
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Post("/users", h.HandleCreateAdmin)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Get("/users", h.HandleListAdmins)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Get("/users/{id}", h.HandleGetAdmin)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Put("/users/{id}", h.HandleUpdateAdmin)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Delete("/users/{id}", h.HandleDeactivateAdmin)
		r.With(adminMW.RequireRole(adminModel.RoleSupervisor)).Get("/users/{id}/subordinates", h.HandleListSubordinates)

		// ── Dashboard + Analytics ──
		r.Get("/dashboard/stats", e.HandleDashboardStats)
		r.Get("/dashboard/redemptions-by-day", a.HandleRedemptionsByDay)
		r.Get("/dashboard/category-distribution", a.HandleCategoryDistribution)
		r.Get("/dashboard/center-utilization", a.HandleCenterUtilization)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Get("/dashboard/fraud", s.HandleFraudIndicators)

		// ── CSV Exports (L1+) ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/export/households", a.HandleExportHouseholds)
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/export/redemptions", a.HandleExportRedemptions)

		// ── Households ──
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/households", e.HandleListHouseholds)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/households/{id}", e.HandleGetHousehold)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/households/{id}/suspend", e.HandleSuspendHousehold)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/households/{id}/reactivate", e.HandleReactivateHousehold)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Put("/households/{id}/notes", e.HandleUpdateHouseholdNotes)
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Put("/households/{id}/kyc-status", e.HandleUpdateHouseholdKYCStatus)

		// ── Members ──
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/members", e.HandleListMembers)
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Post("/members/{id}/verify-kyc", e.HandleVerifyMemberKYC)
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Post("/members/bulk-verify", e.HandleBulkVerifyMembers)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Delete("/members/{id}", e.HandleDeleteMember)

		// ── Allocations ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/allocations", e.HandleListAllocations)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Put("/allocations/{id}/adjust", e.HandleAdjustAllocation)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/allocations/{id}/pause", e.HandlePauseAllocation)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/allocations/{id}/resume", e.HandleResumeAllocation)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/allocations/{id}/expire", e.HandleExpireAllocation)

		// ── Redemptions ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/redemptions", e.HandleListRedemptions)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Post("/redemptions/{id}/resolve-dispute", e.HandleResolveDispute)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/redemptions/{id}/reverse", e.HandleReverseRedemption)

		// ── Distribution Centers ──
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/centers", e.HandleListCenters)
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/centers/{id}", e.HandleGetCenter)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Post("/centers", e.HandleCreateCenter)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Put("/centers/{id}", e.HandleUpdateCenter)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Put("/centers/{id}/stock", e.HandleUpdateCenterStock)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Delete("/centers/{id}", e.HandleDeactivateCenter)

		// ── Power Banks ──
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Get("/powerbanks", e.HandleListPowerBanks)
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Put("/powerbanks/{id}/status", e.HandleForceSwapStatus)

		// ── Providers ──
		r.With(adminMW.RequireRole(adminModel.RoleDistributionMgr)).Get("/providers", e.HandleListProviders)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/providers/{id}/approve", e.HandleApproveProvider)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/providers/{id}/reject", e.HandleRejectProvider)

		// ── Volunteers ──
		r.With(adminMW.RequireRole(adminModel.RoleKYCOfficer)).Get("/volunteers", e.HandleListVolunteers)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/volunteers/{id}/approve", e.HandleApproveVolunteer)
		r.With(adminMW.RequireRole(adminModel.RoleSeniorSupervisor)).Post("/volunteers/{id}/reject", e.HandleRejectVolunteer)

		// ── Tickets ──
		r.With(adminMW.RequireRole(adminModel.RoleFieldAgent)).Get("/tickets", e.HandleListTickets)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/tickets/{id}/resolve", e.HandleResolveTicket)

		// ── Catalog Items ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/catalog/items", e.HandleListCatalogItems)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/catalog/items", e.HandleCreateCatalogItem)

		// ── Notices ──
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Get("/notices", s.HandleListNotices)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/notices", s.HandleCreateNotice)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Put("/notices/reorder", s.HandleReorderNotices)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Put("/notices/{id}", s.HandleUpdateNotice)
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Delete("/notices/{id}", s.HandleDeleteNotice)
		// Legacy bulk-replace endpoint kept for backward compatibility with the
		// admin frontend during the rollout to per-record CRUD.
		r.With(adminMW.RequireRole(adminModel.RoleOperationsMgr)).Post("/notices/replace", s.HandleSaveNotices)

		// ── System Settings ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/settings", s.HandleListSettings)
		r.With(adminMW.RequireRole(adminModel.RoleCTO)).Put("/settings/{key}", s.HandleUpdateSetting)

		// ── Audit Trail ──
		r.With(adminMW.RequireRole(adminModel.RoleViewer)).Get("/audit", s.HandleListAuditLogs)
	})
}
