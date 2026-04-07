// Package middleware provides security middleware for the admin panel.
//
// Security design (OWASP-aligned):
//   - Server-side sessions in Redis (not JWT — sessions are revocable)
//   - 256-bit cryptographically random session tokens
//   - Session bound to IP + User-Agent (prevents session hijacking)
//   - Sliding expiry with absolute maximum lifetime
//   - Constant-time token comparison
//   - All session data server-side (client only holds opaque token)
//   - Progressive lockout on failed OTP attempts
package middleware

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

// Context keys for admin auth data.
type adminContextKey string

const (
	AdminSessionKey adminContextKey = "admin_session"
	AdminUserIDKey  adminContextKey = "admin_user_id"
	AdminRoleKey    adminContextKey = "admin_role_level"
	AdminScopeKey   adminContextKey = "admin_province_scope"

	// Redis key prefixes.
	sessionPrefix   = "admin:session:"
	otpPrefix       = "admin:otp:"
	lockoutPrefix   = "admin:lockout:"
	attemptPrefix   = "admin:attempts:"

	// Security constants.
	sessionTokenBytes     = 32   // 256 bits of entropy
	sessionTTL            = 8 * time.Hour
	sessionAbsoluteMax    = 24 * time.Hour // Hard limit regardless of activity
	otpTTL                = 2 * time.Minute
	otpLength             = 6
	maxOTPAttempts        = 3
	lockoutBaseMinutes    = 5
	lockoutMaxMinutes     = 60
	maxFailedLogins       = 5
)

// ─── Session Token Generation ───

// GenerateSessionToken creates a cryptographically secure random token.
// Uses crypto/rand (CSPRNG) — never math/rand.
func GenerateSessionToken() (string, error) {
	b := make([]byte, sessionTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate session token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// GenerateOTP creates a cryptographically secure 6-digit OTP.
func GenerateOTP() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate OTP: %w", err)
	}
	// Convert to 6-digit number: reduce to range [100000, 999999]
	num := (int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])) % 900000
	if num < 0 {
		num = -num
	}
	return fmt.Sprintf("%06d", num+100000), nil
}

// ─── Session Store Operations ───

// CreateSession creates a new admin session in Redis.
func CreateSession(ctx context.Context, rdb *redis.Client, session *adminModel.AdminSession) error {
	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	key := sessionPrefix + session.ID
	if err := rdb.Set(ctx, key, data, sessionTTL).Err(); err != nil {
		return fmt.Errorf("store session: %w", err)
	}
	return nil
}

// GetSession retrieves and validates a session from Redis.
// Returns nil if the session doesn't exist, is expired, or fails binding checks.
func GetSession(ctx context.Context, rdb *redis.Client, token, clientIP, clientUA string) (*adminModel.AdminSession, error) {
	key := sessionPrefix + token
	data, err := rdb.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Session not found or expired
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	var session adminModel.AdminSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}

	// Check absolute maximum lifetime.
	if time.Since(session.CreatedAt) > sessionAbsoluteMax {
		_ = rdb.Del(ctx, key).Err()
		return nil, nil
	}

	// Verify IP binding — prevent session hijacking.
	if !ipMatches(session.IPAddress, clientIP) {
		return nil, nil
	}

	// Verify User-Agent binding.
	// SECURITY: Reject empty UA from client — real browsers always send one.
	if session.UserAgent != "" {
		if clientUA == "" || subtle.ConstantTimeCompare([]byte(session.UserAgent), []byte(clientUA)) != 1 {
			return nil, nil
		}
	}

	// Sliding expiry: refresh TTL on activity.
	session.LastActiveAt = time.Now().UTC()
	refreshData, _ := json.Marshal(session)
	_ = rdb.Set(ctx, key, refreshData, sessionTTL).Err()

	return &session, nil
}

// DestroySession removes a session from Redis.
func DestroySession(ctx context.Context, rdb *redis.Client, token string) error {
	return rdb.Del(ctx, sessionPrefix+token).Err()
}

// DestroyAllSessions removes all sessions for an admin user.
// Used when an admin is suspended or their role changes.
func DestroyAllSessions(ctx context.Context, rdb *redis.Client, adminID int64) error {
	pattern := sessionPrefix + "*"
	var cursor uint64
	for {
		keys, next, err := rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			data, err := rdb.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}
			var session adminModel.AdminSession
			if json.Unmarshal(data, &session) == nil && session.AdminID == adminID {
				_ = rdb.Del(ctx, key).Err()
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return nil
}

// ─── OTP Store Operations ───

// StoreOTP stores an OTP for an admin in Redis with TTL.
func StoreOTP(ctx context.Context, rdb *redis.Client, nationalCode, otp string) error {
	key := otpPrefix + nationalCode
	return rdb.Set(ctx, key, otp, otpTTL).Err()
}

// VerifyOTP checks the OTP using constant-time comparison.
// Returns true if valid, false otherwise. Deletes the OTP on success.
func VerifyOTP(ctx context.Context, rdb *redis.Client, nationalCode, candidateOTP string) (bool, error) {
	key := otpPrefix + nationalCode
	storedOTP, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil // Expired or not found
	}
	if err != nil {
		return false, err
	}

	// Constant-time comparison — prevents timing attacks.
	if subtle.ConstantTimeCompare([]byte(storedOTP), []byte(candidateOTP)) != 1 {
		return false, nil
	}

	// Delete OTP after successful verification (single-use).
	_ = rdb.Del(ctx, key).Err()
	return true, nil
}

// ─── Lockout / Brute Force Protection ───

// IncrementFailedAttempts tracks failed OTP attempts. Returns the new count.
func IncrementFailedAttempts(ctx context.Context, rdb *redis.Client, nationalCode string) (int64, error) {
	key := attemptPrefix + nationalCode
	pipe := rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 15*time.Minute)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

// ClearFailedAttempts resets the attempt counter after successful login.
func ClearFailedAttempts(ctx context.Context, rdb *redis.Client, nationalCode string) {
	_ = rdb.Del(ctx, attemptPrefix+nationalCode).Err()
}

// IsLockedOut checks if the account is currently locked.
func IsLockedOut(ctx context.Context, rdb *redis.Client, nationalCode string) (bool, error) {
	key := lockoutPrefix + nationalCode
	exists, err := rdb.Exists(ctx, key).Result()
	return exists > 0, err
}

// LockAccount locks an account for a progressive duration.
func LockAccount(ctx context.Context, rdb *redis.Client, nationalCode string, failedCount int64) error {
	// Progressive lockout: 5 min → 10 min → 20 min → 30 min → 60 min
	minutes := lockoutBaseMinutes
	for i := int64(maxFailedLogins); i < failedCount; i++ {
		minutes *= 2
		if minutes > lockoutMaxMinutes {
			minutes = lockoutMaxMinutes
			break
		}
	}
	key := lockoutPrefix + nationalCode
	return rdb.Set(ctx, key, "locked", time.Duration(minutes)*time.Minute).Err()
}

// ─── HTTP Middleware ───

// SessionAuth returns middleware that validates admin session tokens.
// The token is read from the Authorization header: "Session <token>"
//
// Security measures:
//   - Server-side session validation (Redis)
//   - IP binding check
//   - User-Agent binding check
//   - Absolute session lifetime enforcement
//   - Sliding expiry on activity
func SessionAuth(rdb *redis.Client, logger *zap.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "session") {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized.WithMessage("Invalid authorization format"))
				return
			}

			token := parts[1]
			if len(token) != sessionTokenBytes*2 { // hex-encoded length
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized.WithMessage("Invalid session token"))
				return
			}

			clientIP := ExtractIP(r)
			clientUA := r.UserAgent()

			session, err := GetSession(r.Context(), rdb, token, clientIP, clientUA)
			if err != nil {
				logger.Error("session validation error", zap.Error(err))
				appErrors.WriteJSON(w, appErrors.ErrInternalServer)
				return
			}
			if session == nil {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized.WithMessage("Session expired or invalid"))
				return
			}

			// Inject session data into context.
			ctx := r.Context()
			ctx = context.WithValue(ctx, AdminSessionKey, session)
			ctx = context.WithValue(ctx, AdminUserIDKey, session.AdminID)
			ctx = context.WithValue(ctx, AdminRoleKey, session.RoleLevel)
			ctx = context.WithValue(ctx, AdminScopeKey, session.ProvinceCodes)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ─── Context Helpers ───

// GetAdminSession extracts the admin session from the request context.
func GetAdminSession(ctx context.Context) *adminModel.AdminSession {
	s, _ := ctx.Value(AdminSessionKey).(*adminModel.AdminSession)
	return s
}

// GetAdminUserID extracts the admin user ID from the request context.
func GetAdminUserID(ctx context.Context) int64 {
	id, _ := ctx.Value(AdminUserIDKey).(int64)
	return id
}

// GetAdminRoleLevel extracts the admin role level from the request context.
func GetAdminRoleLevel(ctx context.Context) int {
	level, _ := ctx.Value(AdminRoleKey).(int)
	return level
}

// GetAdminScope extracts the admin's province scope from the request context.
func GetAdminScope(ctx context.Context) []string {
	scope, _ := ctx.Value(AdminScopeKey).([]string)
	return scope
}

// ─── Helpers ───

// ExtractIP gets the real client IP, handling proxies.
// NOTE: In production behind nginx, only trust X-Real-IP set by nginx.
func ExtractIP(r *http.Request) string {
	// Check X-Real-IP (set by nginx)
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	// Check X-Forwarded-For (first IP is the client)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.SplitN(xff, ",", 2)
		return strings.TrimSpace(parts[0])
	}
	// Fallback to RemoteAddr
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

// MaxOTPAttemptsExported returns the max OTP attempts constant for use by the service layer.
func MaxOTPAttemptsExported() int {
	return maxOTPAttempts
}

// ipMatches checks if two IPs are the same (handles IPv4-mapped IPv6).
func ipMatches(stored, incoming string) bool {
	s := net.ParseIP(stored)
	i := net.ParseIP(incoming)
	if s == nil || i == nil {
		return stored == incoming
	}
	return s.Equal(i)
}
