package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

type contextKey string

const (
	TelegramUserIDKey contextKey = "telegram_user_id"
)

// GetTelegramUserID extracts the authenticated Telegram user ID from the request context.
func GetTelegramUserID(ctx context.Context) int64 {
	id, _ := ctx.Value(TelegramUserIDKey).(int64)
	return id
}

type telegramUser struct {
	ID int64 `json:"id"`
}

// TelegramAuth returns middleware that validates Telegram Mini App initData.
// The initData is passed in the Authorization header as "tma <initData>".
func TelegramAuth(botToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "tma") {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized.WithMessage("Invalid authorization format, expected: tma <initData>"))
				return
			}

			initData := parts[1]

			userID, err := validateInitData(initData, botToken)
			if err != nil {
				appErrors.WriteJSON(w, appErrors.ErrUnauthorized.WithMessage(err.Error()))
				return
			}

			ctx := context.WithValue(r.Context(), TelegramUserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// validateInitData validates Telegram Mini App initData per the official spec.
// Returns the telegram user ID on success.
func validateInitData(initData, botToken string) (int64, error) {
	params, err := url.ParseQuery(initData)
	if err != nil {
		return 0, fmt.Errorf("invalid initData format")
	}

	hash := params.Get("hash")
	if hash == "" {
		return 0, fmt.Errorf("missing hash in initData")
	}

	// Validate auth_date freshness (24 hour window).
	authDateStr := params.Get("auth_date")
	if authDateStr == "" {
		return 0, fmt.Errorf("missing auth_date in initData")
	}
	authDate, err := strconv.ParseInt(authDateStr, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid auth_date")
	}
	age := math.Abs(float64(time.Now().Unix() - authDate))
	if age > 86400 { // 24 hours
		return 0, fmt.Errorf("initData has expired")
	}

	// Build data-check-string: sort params alphabetically (excluding hash), join with \n.
	params.Del("hash")
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var dataCheckParts []string
	for _, k := range keys {
		dataCheckParts = append(dataCheckParts, fmt.Sprintf("%s=%s", k, params.Get(k)))
	}
	dataCheckString := strings.Join(dataCheckParts, "\n")

	// HMAC-SHA256("WebAppData", botToken) → secret key
	secretKeyMac := hmac.New(sha256.New, []byte("WebAppData"))
	secretKeyMac.Write([]byte(botToken))
	secretKey := secretKeyMac.Sum(nil)

	// HMAC-SHA256(secretKey, dataCheckString) → computed hash
	dataMac := hmac.New(sha256.New, secretKey)
	dataMac.Write([]byte(dataCheckString))
	computedHash := hex.EncodeToString(dataMac.Sum(nil))

	if !hmac.Equal([]byte(computedHash), []byte(hash)) {
		return 0, fmt.Errorf("invalid initData signature")
	}

	// Extract user ID from the user JSON parameter.
	userJSON := params.Get("user")
	if userJSON == "" {
		return 0, fmt.Errorf("missing user in initData")
	}

	var user telegramUser
	if err := json.Unmarshal([]byte(userJSON), &user); err != nil {
		return 0, fmt.Errorf("invalid user data in initData")
	}
	if user.ID == 0 {
		return 0, fmt.Errorf("invalid user ID in initData")
	}

	return user.ID, nil
}
