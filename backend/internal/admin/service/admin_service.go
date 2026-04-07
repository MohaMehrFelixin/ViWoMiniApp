package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/admin/repository"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

// AdminService handles admin authentication, user management, and audit logging.
type AdminService struct {
	adminRepo   repository.AdminRepository
	auditRepo   repository.AuditRepository
	rdb         *redis.Client
	idGen       *idgen.Generator
	logger      *zap.Logger
	environment string // "development" | "production" — controls OTP visibility
}

// NewAdminService creates a new admin service. The environment determines
// whether the full OTP is logged for development convenience.
func NewAdminService(
	adminRepo repository.AdminRepository,
	auditRepo repository.AuditRepository,
	rdb *redis.Client,
	idGen *idgen.Generator,
	environment string,
	logger *zap.Logger,
) *AdminService {
	return &AdminService{
		adminRepo:   adminRepo,
		auditRepo:   auditRepo,
		rdb:         rdb,
		idGen:       idGen,
		environment: environment,
		logger:      logger,
	}
}

// audit writes an audit entry, surfacing failures (FIX B4). Mirrors the helper
// in EntityService.
func (s *AdminService) audit(ctx context.Context, entry *adminModel.AuditLog) {
	if err := s.auditRepo.Log(ctx, entry); err != nil {
		s.logger.Error("audit_log_failed",
			zap.String("action", entry.Action),
			zap.String("entity_type", entry.EntityType),
			zap.Int64("admin_id", entry.AdminID),
			zap.Error(err),
		)
	}
}

// ─── Authentication ───

// RequestOTP sends an OTP to the admin's registered phone.
// Returns the phone number (masked) for the frontend.
func (s *AdminService) RequestOTP(ctx context.Context, nationalCode string) (string, int, error) {
	// Check lockout first.
	locked, err := adminMW.IsLockedOut(ctx, s.rdb, nationalCode)
	if err != nil {
		return "", 0, appErrors.ErrServiceUnavailable
	}
	if locked {
		return "", 0, appErrors.ErrRateLimited.WithMessage("Account is temporarily locked. Please try again later.")
	}

	// Find admin by national code.
	admin, err := s.adminRepo.GetByNationalCode(ctx, nationalCode)
	if err != nil {
		return "", 0, fmt.Errorf("admin_service: get admin: %w", err)
	}

	// SECURITY: Always return identical response shape to prevent enumeration.
	// Attacker cannot distinguish "doesn't exist" from "exists but suspended".
	fakePhone := "09xx***xx00"
	if admin == nil || admin.Status != "active" {
		// Still generate+store an OTP (thrown away) to normalize timing.
		_, _ = adminMW.GenerateOTP()
		return fakePhone, 120, nil
	}

	// Generate and store OTP.
	otp, err := adminMW.GenerateOTP()
	if err != nil {
		return "", 0, appErrors.ErrInternalServer
	}
	if err := adminMW.StoreOTP(ctx, s.rdb, nationalCode, otp); err != nil {
		return "", 0, appErrors.ErrServiceUnavailable
	}

	// SMS delivery: in production this would call Kavenegar/Twilio. The SMS
	// integration is a separate scoped task — for now we always log a hint
	// at INFO and, in development only, the full OTP at WARN level so local
	// admins can log in without shell access to Redis.
	//
	// SECURITY: NEVER enable the dev WARN log in production. The environment
	// flag is checked explicitly so a misconfigured ENV var doesn't leak OTPs.
	if s.environment == "development" {
		s.logger.Warn("[DEV] admin OTP — DO NOT use in production",
			zap.String("national_code", nationalCode),
			zap.String("otp", otp),
		)
	} else {
		s.logger.Info("admin OTP generated",
			zap.String("national_code", nationalCode[:4]+"******"),
		)
		// TODO(prod): Replace with SMS provider call. Tracked in ProdRollout.
	}

	// Mask phone for response: 09xx***xx45
	masked := maskPhone(admin.Phone)
	return masked, 120, nil // 120 seconds expiry
}

// VerifyOTP validates the OTP and creates a new session.
func (s *AdminService) VerifyOTP(ctx context.Context, nationalCode, otp, clientIP, clientUA string) (*adminModel.LoginResponse, error) {
	// Check lockout.
	locked, err := adminMW.IsLockedOut(ctx, s.rdb, nationalCode)
	if err != nil {
		return nil, appErrors.ErrServiceUnavailable
	}
	if locked {
		return nil, appErrors.ErrRateLimited.WithMessage("Account is temporarily locked")
	}

	// Verify OTP (constant-time comparison).
	valid, err := adminMW.VerifyOTP(ctx, s.rdb, nationalCode, otp)
	if err != nil {
		return nil, appErrors.ErrServiceUnavailable
	}
	if !valid {
		// Increment failed attempts.
		count, _ := adminMW.IncrementFailedAttempts(ctx, s.rdb, nationalCode)
		if count >= int64(adminMW.MaxOTPAttemptsExported()) {
			_ = adminMW.LockAccount(ctx, s.rdb, nationalCode, count)
		}
		return nil, appErrors.ErrUnauthorized.WithMessage("Invalid or expired verification code")
	}

	// Fetch admin.
	admin, err := s.adminRepo.GetByNationalCode(ctx, nationalCode)
	if err != nil || admin == nil {
		return nil, appErrors.ErrUnauthorized
	}
	if admin.Status != "active" {
		return nil, appErrors.ErrForbidden.WithMessage("Account is not active")
	}

	// Clear failed attempts on successful login.
	adminMW.ClearFailedAttempts(ctx, s.rdb, nationalCode)
	_ = s.adminRepo.ClearFailedAttempts(ctx, admin.ID)
	_ = s.adminRepo.UpdateLastLogin(ctx, admin.ID, clientIP)

	// Generate session token.
	token, err := adminMW.GenerateSessionToken()
	if err != nil {
		return nil, appErrors.ErrInternalServer
	}

	now := time.Now().UTC()
	session := &adminModel.AdminSession{
		ID:            token,
		AdminID:       admin.ID,
		RoleLevel:     admin.RoleLevel,
		ProvinceCodes: admin.ProvinceCodes,
		IPAddress:     clientIP,
		UserAgent:     clientUA,
		CreatedAt:     now,
		LastActiveAt:  now,
	}

	if err := adminMW.CreateSession(ctx, s.rdb, session); err != nil {
		return nil, appErrors.ErrServiceUnavailable
	}

	// Audit log: login.
	s.audit(ctx, &adminModel.AuditLog{
		AdminID:    admin.ID,
		Action:     "login",
		EntityType: "admin_user",
		EntityID:   &admin.ID,
		IPAddress:  clientIP,
		UserAgent:  clientUA,
		SessionID:  token,
	})

	return &adminModel.LoginResponse{
		SessionToken: token,
		ExpiresAt:    now.Add(8 * time.Hour),
		Admin:        admin,
	}, nil
}

// Logout destroys the current session.
func (s *AdminService) Logout(ctx context.Context, session *adminModel.AdminSession) error {
	s.audit(ctx, &adminModel.AuditLog{
		AdminID:    session.AdminID,
		Action:     "logout",
		EntityType: "admin_user",
		EntityID:   &session.AdminID,
		IPAddress:  session.IPAddress,
		UserAgent:  session.UserAgent,
		SessionID:  session.ID,
	})
	return adminMW.DestroySession(ctx, s.rdb, session.ID)
}

// GetProfile returns the current admin's profile.
func (s *AdminService) GetProfile(ctx context.Context, adminID int64) (*adminModel.AdminUser, error) {
	admin, err := s.adminRepo.GetByID(ctx, adminID)
	if err != nil {
		return nil, fmt.Errorf("admin_service: get profile: %w", err)
	}
	if admin == nil {
		return nil, appErrors.ErrNotFound
	}
	return admin, nil
}

// GetAdminStatus returns the status of an admin (used by RequireActive middleware).
func (s *AdminService) GetAdminStatus(ctx context.Context, adminID int64) (string, error) {
	admin, err := s.adminRepo.GetByID(ctx, adminID)
	if err != nil || admin == nil {
		return "deactivated", err
	}
	return admin.Status, nil
}

// ─── User Management ───

// CreateAdmin creates a new admin user. Enforces hierarchy rules.
func (s *AdminService) CreateAdmin(ctx context.Context, req *adminModel.CreateAdminRequest, actorID int64, actorLevel int) (*adminModel.AdminUser, error) {
	// Hierarchy check: actor must be higher level than target.
	if !adminModel.CanManageRole(actorLevel, req.RoleLevel) {
		return nil, appErrors.ErrForbidden.WithMessage("Cannot create admin at same or higher level")
	}

	// Check if national code already exists.
	existing, _ := s.adminRepo.GetByNationalCode(ctx, req.NationalCode)
	if existing != nil {
		return nil, appErrors.ErrConflict.WithMessage("Admin with this national code already exists")
	}

	id, _ := s.idGen.Generate()
	title := adminModel.RoleTitles[req.RoleLevel]
	if title == "" {
		title = "viewer"
	}

	admin := &adminModel.AdminUser{
		ID:            id,
		NationalCode:  req.NationalCode,
		FullName:      req.FullName,
		Phone:         req.Phone,
		RoleLevel:     req.RoleLevel,
		RoleTitle:     title,
		ProvinceCodes: req.ProvinceCodes,
		ParentAdminID: &actorID,
		Status:        "active",
	}

	if err := s.adminRepo.Create(ctx, admin); err != nil {
		return nil, fmt.Errorf("admin_service: create: %w", err)
	}

	// Audit.
	s.audit(ctx, &adminModel.AuditLog{
		AdminID:    actorID,
		Action:     "create",
		EntityType: "admin_user",
		EntityID:   &admin.ID,
		NewValue:   admin,
	})

	return admin, nil
}

// ListAdmins returns a paginated list of admin users.
func (s *AdminService) ListAdmins(ctx context.Context, offset, limit int) ([]adminModel.AdminUser, int, error) {
	return s.adminRepo.GetPaginated(ctx, offset, limit)
}

// GetAdmin returns a single admin user by id.
func (s *AdminService) GetAdmin(ctx context.Context, id int64) (*adminModel.AdminUser, error) {
	a, err := s.adminRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, appErrors.ErrNotFound
	}
	return a, nil
}

// UpdateAdmin updates a target admin's profile. Only allowed if actorLevel
// can manage targetLevel (downward-only rule).
func (s *AdminService) UpdateAdmin(ctx context.Context, targetID int64, req *adminModel.UpdateAdminRequest, actorID int64, actorLevel int) (*adminModel.AdminUser, error) {
	target, err := s.adminRepo.GetByID(ctx, targetID)
	if err != nil {
		return nil, err
	}
	if target == nil {
		return nil, appErrors.ErrNotFound
	}
	// Hierarchy enforcement: actor must be strictly higher than the CURRENT
	// level of the target AND any new role level being assigned.
	if !adminModel.CanManageRole(actorLevel, target.RoleLevel) {
		return nil, appErrors.ErrForbidden.WithMessage("Cannot edit admin at same or higher level")
	}
	if req.RoleLevel != nil {
		if !adminModel.CanManageRole(actorLevel, *req.RoleLevel) {
			return nil, appErrors.ErrForbidden.WithMessage("Cannot promote to same or higher level than your own")
		}
		target.RoleLevel = *req.RoleLevel
		title := adminModel.RoleTitles[*req.RoleLevel]
		if title != "" {
			target.RoleTitle = title
		}
	}
	if req.FullName != nil {
		target.FullName = *req.FullName
	}
	if req.Phone != nil {
		target.Phone = *req.Phone
	}
	if req.ProvinceCodes != nil {
		target.ProvinceCodes = req.ProvinceCodes
	}
	if req.Status != nil {
		target.Status = *req.Status
	}
	if err := s.adminRepo.Update(ctx, target); err != nil {
		return nil, err
	}

	// If the admin was deactivated/suspended, revoke all their active
	// sessions immediately so they can't continue operating.
	if target.Status != "active" {
		_ = adminMW.DestroyAllSessions(ctx, s.rdb, target.ID)
	}

	s.audit(ctx, &adminModel.AuditLog{
		AdminID:    actorID,
		Action:     "update",
		EntityType: "admin_user",
		EntityID:   &target.ID,
		NewValue:   target,
	})
	return target, nil
}

// DeactivateAdmin sets a user's status to deactivated and destroys their sessions.
func (s *AdminService) DeactivateAdmin(ctx context.Context, targetID, actorID int64, actorLevel int) error {
	target, err := s.adminRepo.GetByID(ctx, targetID)
	if err != nil {
		return err
	}
	if target == nil {
		return appErrors.ErrNotFound
	}
	if !adminModel.CanManageRole(actorLevel, target.RoleLevel) {
		return appErrors.ErrForbidden.WithMessage("Cannot deactivate admin at same or higher level")
	}
	if err := s.adminRepo.UpdateStatus(ctx, targetID, "deactivated"); err != nil {
		return err
	}
	_ = adminMW.DestroyAllSessions(ctx, s.rdb, targetID)
	s.audit(ctx, &adminModel.AuditLog{
		AdminID:    actorID,
		Action:     "deactivate",
		EntityType: "admin_user",
		EntityID:   &targetID,
	})
	return nil
}

// ListSubordinates returns the direct reports of a given admin.
func (s *AdminService) ListSubordinates(ctx context.Context, parentID int64) ([]adminModel.AdminUser, error) {
	return s.adminRepo.GetByParent(ctx, parentID)
}

// ─── Helpers ───

func maskPhone(phone string) string {
	if len(phone) < 6 {
		return "****"
	}
	return phone[:4] + "***" + phone[len(phone)-2:]
}

// CanManageRole re-exports the hierarchy check for convenience.
func CanManageRole(actorLevel, targetLevel int) bool {
	return actorLevel > targetLevel
}
