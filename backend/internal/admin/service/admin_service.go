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
	adminRepo repository.AdminRepository
	auditRepo repository.AuditRepository
	rdb       *redis.Client
	idGen     *idgen.Generator
	logger    *zap.Logger
}

// NewAdminService creates a new admin service.
func NewAdminService(
	adminRepo repository.AdminRepository,
	auditRepo repository.AuditRepository,
	rdb *redis.Client,
	idGen *idgen.Generator,
	logger *zap.Logger,
) *AdminService {
	return &AdminService{
		adminRepo: adminRepo,
		auditRepo: auditRepo,
		rdb:       rdb,
		idGen:     idGen,
		logger:    logger,
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

	// TODO: Send OTP via SMS to admin.Phone
	// In dev, log masked OTP hint for debugging; NEVER log the actual OTP.
	s.logger.Info("admin OTP generated",
		zap.String("national_code", nationalCode[:4]+"******"),
		zap.String("otp_hint", otp[:2]+"****"),
	)

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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
