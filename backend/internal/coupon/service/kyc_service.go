package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/viwo-app/mini-coupon/internal/finnotech"
)

const (
	otpSessionTTL        = 5 * time.Minute
	otpMaxAttempts       = 3
	otpMaxSendsPerMobile = 3
	otpMobileRateTTL     = 5 * time.Minute
)

// KYCService orchestrates KYC verification using Finnotech APIs.
type KYCService struct {
	finnotech *finnotech.Client
	redis     *redis.Client
	logger    *zap.Logger
	enabled   bool
}

// NewKYCService creates a KYC verification service.
func NewKYCService(fn *finnotech.Client, rdb *redis.Client, logger *zap.Logger, enabled bool) *KYCService {
	return &KYCService{
		finnotech: fn,
		redis:     rdb,
		logger:    logger,
		enabled:   enabled,
	}
}

// IsEnabled returns whether Finnotech integration is active.
func (s *KYCService) IsEnabled() bool {
	return s.enabled
}

type otpSession struct {
	Mobile         string `json:"mobile"`
	NationalCode   string `json:"national_code"`
	TelegramUserID int64  `json:"telegram_user_id"`
	Attempts       int    `json:"attempts"`
	SendCount      int    `json:"send_count"`
	Verified       bool   `json:"verified"`
	AuthCode       string `json:"auth_code,omitempty"`
}

// SendOTPResult is the response when OTP is sent.
type SendOTPResult struct {
	TrackID   string `json:"track_id"`
	ExpiresIn int    `json:"expires_in"`
}

// SendOTP sends an OTP SMS via Finnotech to the given mobile.
func (s *KYCService) SendOTP(ctx context.Context, mobile, nationalCode string, telegramUserID int64) (*SendOTPResult, error) {
	if !s.enabled {
		return nil, finnotech.ErrKYCNotConfigured
	}

	// Atomic rate limit: pipeline ensures INCR + EXPIRE execute together.
	rateKey := fmt.Sprintf("kyc:otp:rate:%s", mobile)
	pipe := s.redis.TxPipeline()
	incrCmd := pipe.Incr(ctx, rateKey)
	pipe.Expire(ctx, rateKey, otpMobileRateTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		s.logger.Error("kyc: rate limit Redis error", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}
	count := incrCmd.Val()
	if count > int64(otpMaxSendsPerMobile) {
		return nil, finnotech.ErrOTPRateLimit
	}

	resp, err := s.finnotech.SendOTP(ctx, mobile)
	if err != nil {
		return nil, err
	}
	trackID := resp.TrackID
	if trackID == "" {
		trackID = uuid.New().String()[:20]
	}

	// Store session in Redis
	session := otpSession{
		Mobile:         mobile,
		NationalCode:   nationalCode,
		TelegramUserID: telegramUserID,
		Attempts:       0,
		SendCount:      int(count),
		Verified:       false,
	}
	data, _ := json.Marshal(session)
	if err := s.redis.Set(ctx, fmt.Sprintf("kyc:otp:%s", trackID), data, otpSessionTTL).Err(); err != nil {
		s.logger.Error("kyc: failed to persist OTP session", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}

	return &SendOTPResult{
		TrackID:   trackID,
		ExpiresIn: int(otpSessionTTL.Seconds()),
	}, nil
}

// VerifyOTPResult is the response when OTP is verified.
type VerifyOTPResult struct {
	Verified bool   `json:"verified"`
	TrackID  string `json:"track_id"`
}

// VerifyOTP verifies the OTP code for the given track ID.
func (s *KYCService) VerifyOTP(ctx context.Context, mobile, nationalCode, otp, trackID string, telegramUserID int64) (*VerifyOTPResult, error) {
	if !s.enabled {
		return nil, finnotech.ErrKYCNotConfigured
	}

	sessionKey := fmt.Sprintf("kyc:otp:%s", trackID)
	data, err := s.redis.Get(ctx, sessionKey).Bytes()
	if err != nil {
		return nil, finnotech.ErrOTPExpired
	}

	var session otpSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("kyc: session decode failed: %w", err)
	}

	// Verify session belongs to the calling Telegram user
	if session.TelegramUserID != telegramUserID {
		return nil, finnotech.ErrSessionMismatch
	}

	// Verify session belongs to same mobile+nid
	if session.Mobile != mobile || session.NationalCode != nationalCode {
		return nil, finnotech.ErrSessionMismatch
	}

	// Check attempts
	if session.Attempts >= otpMaxAttempts {
		return nil, finnotech.ErrOTPMaxAttempts
	}

	verifyResp, err := s.finnotech.VerifyOTP(ctx, mobile, nationalCode, otp, trackID)
	if err != nil {
		// Increment attempts on failure — preserve original TTL
		session.Attempts++
		data, _ = json.Marshal(session)
		s.redis.Set(ctx, sessionKey, data, redis.KeepTTL)
		return nil, finnotech.ErrOTPInvalid
	}

	// Mark as verified
	session.Verified = true
	session.AuthCode = verifyResp.Code
	data, _ = json.Marshal(session)
	if err := s.redis.Set(ctx, sessionKey, data, 15*time.Minute).Err(); err != nil {
		s.logger.Error("kyc: failed to persist verified session", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}

	return &VerifyOTPResult{
		Verified: true,
		TrackID:  trackID,
	}, nil
}

// VerifyIdentityResult is the response from full identity verification.
type VerifyIdentityResult struct {
	ShahkarMatched bool   `json:"shahkar_matched"`
	NIDVerified    bool   `json:"nid_verified"`
	TrackID        string `json:"track_id"`
}

// VerifyIdentity performs Shahkar matching + NID verification.
func (s *KYCService) VerifyIdentity(ctx context.Context, nationalCode, fullName, birthDate, gender, mobile, trackID string, telegramUserID int64) (*VerifyIdentityResult, error) {
	if !s.enabled {
		return nil, finnotech.ErrKYCNotConfigured
	}

	// Check OTP was verified
	sessionKey := fmt.Sprintf("kyc:otp:%s", trackID)
	data, err := s.redis.Get(ctx, sessionKey).Bytes()
	if err != nil {
		return nil, finnotech.ErrOTPExpired
	}

	var session otpSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("kyc: session decode failed: %w", err)
	}

	// Verify session belongs to the calling Telegram user
	if session.TelegramUserID != telegramUserID {
		return nil, finnotech.ErrSessionMismatch
	}

	if !session.Verified {
		return nil, fmt.Errorf("kyc: OTP not verified for this track ID")
	}

	result := &VerifyIdentityResult{TrackID: trackID}

	// Step 1: Shahkar — match mobile + national code
	shahkarResult, err := s.finnotech.MatchMobileNID(ctx, mobile, nationalCode, trackID)
	if err != nil {
		s.logger.Error("kyc: shahkar verification failed", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}
	result.ShahkarMatched = shahkarResult.Matched

	if !shahkarResult.Matched {
		return result, finnotech.ErrShahkarMismatch
	}

	// Step 2: NID Verification — verify identity details
	nidResult, err := s.finnotech.VerifyNID(ctx, nationalCode, fullName, birthDate, gender, trackID)
	if err != nil {
		s.logger.Error("kyc: NID verification failed", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}
	result.NIDVerified = nidResult.Verified

	if !nidResult.Verified {
		return result, finnotech.ErrNIDVerificationFailed
	}

	// Mark track ID as fully verified (for registration step)
	if err := s.redis.Set(ctx, fmt.Sprintf("kyc:verified:%s", trackID), "1", 30*time.Minute).Err(); err != nil {
		s.logger.Error("kyc: failed to persist verification status", zap.Error(err))
		return nil, finnotech.ErrServiceUnavailable
	}

	return result, nil
}

// IsTrackIDVerified checks if a KYC track ID has been fully verified.
func (s *KYCService) IsTrackIDVerified(ctx context.Context, trackID string) bool {
	if !s.enabled {
		return false
	}
	val, err := s.redis.Get(ctx, fmt.Sprintf("kyc:verified:%s", trackID)).Result()
	return err == nil && val == "1"
}
