package model

import "time"

// Role levels — higher levels inherit all permissions of lower levels.
const (
	RoleViewer             = 1
	RoleFieldAgent         = 2
	RoleDistributionMgr    = 3
	RoleKYCOfficer         = 4
	RoleOperationsMgr      = 5
	RoleSupervisor         = 6
	RoleSeniorSupervisor   = 7
	RoleRegionalDirector   = 8
	RoleCTO                = 9
	RoleCEO                = 10
)

// RoleTitles maps level to human-readable title.
var RoleTitles = map[int]string{
	1:  "viewer",
	2:  "field_agent",
	3:  "distribution_manager",
	4:  "kyc_officer",
	5:  "operations_manager",
	6:  "supervisor",
	7:  "senior_supervisor",
	8:  "regional_director",
	9:  "cto",
	10: "ceo",
}

// AdminUser represents an admin panel user.
type AdminUser struct {
	ID             int64      `json:"id"`
	NationalCode   string     `json:"national_code"`
	FullName       string     `json:"full_name"`
	Phone          string     `json:"phone"`
	BirthDate      *time.Time `json:"birth_date,omitempty"`
	Gender         *string    `json:"gender,omitempty"`
	RoleLevel      int        `json:"role_level"`
	RoleTitle      string     `json:"role_title"`
	ProvinceCodes  []string   `json:"province_codes"`
	ParentAdminID  *int64     `json:"parent_admin_id,omitempty"`
	Status         string     `json:"status"`
	FailedAttempts int        `json:"failed_attempts"`
	LockedUntil    *time.Time `json:"locked_until,omitempty"`
	LastLoginAt    *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP    *string    `json:"last_login_ip,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// AdminSession is the server-side session stored in Redis.
// Sessions are NEVER exposed to the client — only the session ID (token) is.
type AdminSession struct {
	ID            string    `json:"id"`              // Cryptographically random 256-bit token
	AdminID       int64     `json:"admin_id"`
	RoleLevel     int       `json:"role_level"`
	ProvinceCodes []string  `json:"province_codes"`
	IPAddress     string    `json:"ip_address"`      // Bound to originating IP
	UserAgent     string    `json:"user_agent"`      // Bound to originating UA
	CreatedAt     time.Time `json:"created_at"`
	LastActiveAt  time.Time `json:"last_active_at"`  // Sliding expiry
}

// AuditLog records every admin action for accountability.
type AuditLog struct {
	ID         int64       `json:"id"`
	AdminID    int64       `json:"admin_id"`
	Action     string      `json:"action"`
	EntityType string      `json:"entity_type"`
	EntityID   *int64      `json:"entity_id,omitempty"`
	OldValue   interface{} `json:"old_value,omitempty"`
	NewValue   interface{} `json:"new_value,omitempty"`
	IPAddress  string      `json:"ip_address"`
	UserAgent  string      `json:"user_agent"`
	SessionID  string      `json:"session_id"`
	CreatedAt  time.Time   `json:"created_at"`
}

// CanManageRole checks if actorLevel can manage targetLevel.
// Rule: admin at level N can only manage levels 1 through N-1.
func CanManageRole(actorLevel, targetLevel int) bool {
	return actorLevel > targetLevel
}

// ─── Request / Response DTOs ───

type RequestOTPRequest struct {
	NationalCode string `json:"national_code" validate:"required,len=10,numeric"`
}

type VerifyOTPRequest struct {
	NationalCode string `json:"national_code" validate:"required,len=10,numeric"`
	OTP          string `json:"otp" validate:"required,len=6,numeric"`
}

type LoginResponse struct {
	SessionToken string     `json:"session_token"` // Opaque token, not JWT
	ExpiresAt    time.Time  `json:"expires_at"`
	Admin        *AdminUser `json:"admin"`
}

type AdminProfileResponse struct {
	Admin *AdminUser `json:"admin"`
}

type CreateAdminRequest struct {
	NationalCode  string   `json:"national_code" validate:"required,len=10,numeric"`
	FullName      string   `json:"full_name" validate:"required,min=2,max=200"`
	Phone         string   `json:"phone" validate:"required,min=10,max=15"`
	RoleLevel     int      `json:"role_level" validate:"required,min=1,max=10"`
	ProvinceCodes []string `json:"province_codes"`
}

type UpdateAdminRequest struct {
	FullName      *string  `json:"full_name,omitempty" validate:"omitempty,min=2,max=200"`
	Phone         *string  `json:"phone,omitempty" validate:"omitempty,min=10,max=15"`
	RoleLevel     *int     `json:"role_level,omitempty" validate:"omitempty,min=1,max=10"`
	ProvinceCodes []string `json:"province_codes,omitempty"`
	Status        *string  `json:"status,omitempty" validate:"omitempty,oneof=active suspended deactivated"`
}

type AdminListResponse struct {
	Admins []AdminUser `json:"admins"`
	Total  int         `json:"total"`
}

type AuditListResponse struct {
	Logs  []AuditLog `json:"logs"`
	Total int        `json:"total"`
}
