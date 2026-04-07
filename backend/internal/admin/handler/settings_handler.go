package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/admin/repository"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
)

// SettingsHandler manages system settings, notices, and fraud detection.
type SettingsHandler struct {
	entityRepo *repository.EntityRepository
	auditRepo  repository.AuditRepository
	rdb        *redis.Client
	logger     *zap.Logger
}

func NewSettingsHandler(entityRepo *repository.EntityRepository, auditRepo repository.AuditRepository, rdb *redis.Client, logger *zap.Logger) *SettingsHandler {
	return &SettingsHandler{entityRepo: entityRepo, auditRepo: auditRepo, rdb: rdb, logger: logger}
}

// ─── System Settings ───

func (h *SettingsHandler) HandleListSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.entityRepo.ListSettings(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_settings")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"settings": settings})
}

func (h *SettingsHandler) HandleUpdateSetting(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if key == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Missing key"))
		return
	}

	var body struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.UpdateSetting(r.Context(), key, string(body.Value), session.AdminID); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_setting")
		return
	}

	_ = h.auditRepo.Log(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update", EntityType: "system_setting",
		NewValue:  map[string]string{"key": key, "value": string(body.Value)},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "setting updated"})
}

// ─── Notices (Redis-backed) ───

func (h *SettingsHandler) HandleListNotices(w http.ResponseWriter, r *http.Request) {
	val, err := h.rdb.Get(r.Context(), "app:notices").Result()
	if err != nil {
		val = "[]"
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"notices":` + val + `}`))
}

func (h *SettingsHandler) HandleSaveNotices(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}

	// Validate it's valid JSON array
	var arr []json.RawMessage
	if err := json.Unmarshal(body, &arr); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Body must be a JSON array of notices"))
		return
	}

	if err := h.rdb.Set(r.Context(), "app:notices", string(body), 0).Err(); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrServiceUnavailable)
		return
	}

	session := adminMW.GetAdminSession(r.Context())
	_ = h.auditRepo.Log(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update", EntityType: "notices",
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "notices saved"})
}

// ─── Fraud Detection ───

func (h *SettingsHandler) HandleFraudIndicators(w http.ResponseWriter, r *http.Request) {
	alerts, err := h.entityRepo.GetFraudIndicators(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "fraud_indicators")
		return
	}
	if alerts == nil {
		alerts = []map[string]interface{}{}
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"alerts": alerts})
}
