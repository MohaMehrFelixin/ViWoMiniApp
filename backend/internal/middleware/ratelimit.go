package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

type RateLimitConfig struct {
	RequestsPerSecond int
	Burst             int
}

func RateLimiter(rdb *redis.Client, cfg RateLimitConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := rateLimitKey(r)
			allowed, retryAfter, err := checkRateLimit(r.Context(), rdb, key, cfg)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if !allowed {
				w.Header().Set("Retry-After", strconv.FormatInt(retryAfter, 10))
				appErrors.WriteJSON(w, appErrors.ErrRateLimited)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitKey(r *http.Request) string {
	if uid := GetTelegramUserID(r.Context()); uid != 0 {
		return fmt.Sprintf("rl:tg:%d", uid)
	}
	return fmt.Sprintf("rl:ip:%s", r.RemoteAddr)
}

func checkRateLimit(ctx context.Context, rdb *redis.Client, key string, cfg RateLimitConfig) (bool, int64, error) {
	script := redis.NewScript(`
		local key = KEYS[1]
		local burst = tonumber(ARGV[1])
		local rate = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])
		local requested = tonumber(ARGV[4])
		local data = redis.call('HMGET', key, 'tokens', 'last_refill')
		local tokens = tonumber(data[1])
		local last_refill = tonumber(data[2])
		if tokens == nil then
			tokens = burst
			last_refill = now
		end
		local elapsed = math.max(0, now - last_refill)
		tokens = math.min(burst, tokens + (elapsed * rate))
		last_refill = now
		local allowed = 0
		local retry_after = 0
		if tokens >= requested then
			tokens = tokens - requested
			allowed = 1
		else
			retry_after = math.ceil((requested - tokens) / rate)
		end
		redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
		redis.call('EXPIRE', key, math.ceil(burst / rate) + 1)
		return {allowed, retry_after}
	`)

	now := float64(time.Now().UnixMilli()) / 1000.0
	result, err := script.Run(ctx, rdb, []string{key}, cfg.Burst, cfg.RequestsPerSecond, now, 1).Int64Slice()
	if err != nil {
		return false, 0, err
	}
	return result[0] == 1, result[1], nil
}
