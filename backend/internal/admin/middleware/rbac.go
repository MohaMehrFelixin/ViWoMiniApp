package middleware

import (
	"net/http"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

// RequireRole returns middleware that enforces a minimum role level.
// Role levels are hierarchical: level N inherits all permissions of levels < N.
func RequireRole(minLevel int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			level := GetAdminRoleLevel(r.Context())
			if level < minLevel {
				appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("Insufficient role level"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireScope returns middleware that checks the admin has access to the
// province of the entity they're trying to access. Global admins (L9-10)
// with empty province_codes are always allowed.
func RequireScope(getEntityProvince func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			level := GetAdminRoleLevel(r.Context())

			// Global admins (L9-10) bypass scope checks.
			if level >= 9 {
				next.ServeHTTP(w, r)
				return
			}

			scope := GetAdminScope(r.Context())
			if len(scope) == 0 {
				// No scope assigned — deny (except global admins handled above).
				appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("No regional scope assigned"))
				return
			}

			entityProvince := getEntityProvince(r)
			if entityProvince == "" {
				// Can't determine entity province — allow (scope checked in service layer).
				next.ServeHTTP(w, r)
				return
			}

			for _, p := range scope {
				if p == entityProvince {
					next.ServeHTTP(w, r)
					return
				}
			}

			appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("Entity is outside your regional scope"))
		})
	}
}

// CanManageRole checks if the acting admin can manage (create/edit) a target role level.
// Rule: admin at level N can only manage levels 1 through N-1.
func CanManageRole(actorLevel, targetLevel int) bool {
	return actorLevel > targetLevel
}

// RequireActive returns middleware that blocks suspended/deactivated admins
// even if they have a valid session. This catches the edge case where an
// admin is suspended AFTER they logged in.
func RequireActive(getAdminStatus func(ctx interface{}, adminID int64) (string, error)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			adminID := GetAdminUserID(r.Context())
			status, err := getAdminStatus(r.Context(), adminID)
			if err != nil {
				appErrors.WriteJSON(w, appErrors.ErrInternalServer)
				return
			}
			if status != "active" {
				appErrors.WriteJSON(w, appErrors.ErrForbidden.WithMessage("Account is suspended or deactivated"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
