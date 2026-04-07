package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/viwo-app/mini-coupon/internal/middleware"
)

func RegisterRoutes(r chi.Router, h *CouponHandler, reg *RegistrationHandler, tgAuth func(http.Handler) http.Handler, rdb *redis.Client) {
	writeRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 5, Burst: 5})
	qrRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 3, Burst: 5})
	redeemRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 1, Burst: 3})
	noticeRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 5, Burst: 10})

	r.With(noticeRL).Get("/notices", h.HandleGetNotices)

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

		// KYC Verification
		kycRL := middleware.RateLimiter(rdb, middleware.RateLimitConfig{RequestsPerSecond: 3, Burst: 3})
		r.With(kycRL).Post("/kyc/otp/send", h.HandleSendOTP)
		r.With(kycRL).Post("/kyc/otp/verify", h.HandleVerifyOTP)
		r.With(kycRL).Post("/kyc/verify-identity", h.HandleVerifyIdentity)

		// Volunteer / Provider / Product Offering Registration
		r.With(writeRL).Post("/volunteer/register", reg.HandleRegisterVolunteer)
		r.Get("/volunteer/status", reg.HandleGetVolunteerStatus)
		r.With(writeRL).Post("/provider/register", reg.HandleRegisterProvider)
		r.Get("/provider/status", reg.HandleGetProviderStatus)
		r.With(writeRL).Post("/offerings/submit", reg.HandleSubmitProductOfferings)
	})
}
