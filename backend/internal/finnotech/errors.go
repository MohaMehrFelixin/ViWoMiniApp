package finnotech

import "fmt"

// APIError represents an error response from the Finnotech API.
type APIError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("finnotech: API error %d [%s]: %s", e.StatusCode, e.Code, e.Message)
}

// ClassifiedError is a sentinel error that carries HTTP status and error code metadata.
// It implements a classified interface that HandleServiceError can bridge into AppError
// without this package importing internal/errors (avoiding circular deps).
type ClassifiedError struct {
	ErrCode    string
	Msg        string
	StatusCode int
}

func (e *ClassifiedError) Error() string         { return e.Msg }
func (e *ClassifiedError) HTTPStatusCode() int    { return e.StatusCode }
func (e *ClassifiedError) ErrorCode() string      { return e.ErrCode }

// KYC-related sentinel errors with proper HTTP status codes.
var (
	ErrOTPRateLimit         = &ClassifiedError{ErrCode: "OTP_RATE_LIMIT", Msg: "OTP rate limit exceeded", StatusCode: 429}
	ErrOTPExpired           = &ClassifiedError{ErrCode: "OTP_EXPIRED", Msg: "OTP session expired", StatusCode: 410}
	ErrOTPInvalid           = &ClassifiedError{ErrCode: "OTP_INVALID", Msg: "Invalid OTP code", StatusCode: 422}
	ErrOTPMaxAttempts       = &ClassifiedError{ErrCode: "OTP_MAX_ATTEMPTS", Msg: "Max OTP attempts reached", StatusCode: 429}
	ErrShahkarMismatch      = &ClassifiedError{ErrCode: "SHAHKAR_MISMATCH", Msg: "Mobile not registered to this national code", StatusCode: 422}
	ErrNIDVerificationFailed = &ClassifiedError{ErrCode: "NID_VERIFICATION_FAILED", Msg: "National ID verification failed", StatusCode: 422}
	ErrServiceUnavailable   = &ClassifiedError{ErrCode: "SERVICE_UNAVAILABLE", Msg: "Service temporarily unavailable", StatusCode: 503}
	ErrSessionMismatch      = &ClassifiedError{ErrCode: "SESSION_MISMATCH", Msg: "Session does not belong to this user", StatusCode: 403}
	ErrKYCNotConfigured     = &ClassifiedError{ErrCode: "KYC_NOT_CONFIGURED", Msg: "KYC verification service is not configured", StatusCode: 503}
)
