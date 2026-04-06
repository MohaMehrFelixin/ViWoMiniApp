package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/viwo-app/mini-coupon/internal/middleware"
)

func RegisterRoutes(r chi.Router, h *CouponHandler, tgAuth func(http.Handler) http.Handler, rdb *redis.Client) {
	writeRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 5, Burst: 5})
	qrRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 20, Burst: 20})
	redeemRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 10, Burst: 10})

	r.Group(func(r chi.Router) {
		r.Use(tgAuth)
		r.With(writeRL).Post("/household", h.HandleRegisterHousehold)
		r.With(writeRL).Post("/household/members", h.HandleAddMember)
		r.Get("/household", h.HandleGetHousehold)
		r.Get("/household/members", h.HandleGetMembers)
		r.Get("/balances", h.HandleGetBalances)
		r.Get("/balances/{category}", h.HandleGetCategoryBalance)
		r.With(qrRL).Post("/qr/generate", h.HandleGenerateQR)
		r.With(redeemRL).Post("/redeem", h.HandleRedeemCoupon)
		r.Get("/redemptions", h.HandleGetRedemptionHistory)
		r.With(writeRL).Post("/redemptions/{id}/dispute", h.HandleDisputeRedemption)
		r.Get("/centers/nearby", h.HandleGetNearbyCenters)
		r.Get("/centers/{id}", h.HandleGetCenter)

		// Power Bank Swap
		r.With(writeRL).Post("/powerbank/swap", h.HandleRequestSwap)
		r.Get("/powerbank/swaps", h.HandleGetSwaps)
		r.With(writeRL).Post("/powerbank/swaps/{id}/pickup", h.HandlePickUpSwap)
		r.With(writeRL).Post("/powerbank/swaps/{id}/return", h.HandleReturnSwap)
		r.With(writeRL).Post("/powerbank/swaps/{id}/cancel", h.HandleCancelSwap)
	})
}
