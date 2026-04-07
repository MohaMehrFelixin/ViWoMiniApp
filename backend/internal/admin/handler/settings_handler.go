package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	adminMW "github.com/viwo-app/mini-coupon/internal/admin/middleware"
	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/admin/repository"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
)

// SettingsReloadFunc is invoked after every settings PUT so consumers (e.g.
// AllocationService) can refresh their cached snapshot. Receives a context
// scoped to the request so cancellations propagate.
type SettingsReloadFunc func(ctx context.Context) error

// SettingsHandler manages system settings, notices, and fraud detection.
type SettingsHandler struct {
	entityRepo *repository.EntityRepository
	auditRepo  repository.AuditRepository
	rdb        *redis.Client
	reload     SettingsReloadFunc
	logger     *zap.Logger
}

func NewSettingsHandler(
	entityRepo *repository.EntityRepository,
	auditRepo repository.AuditRepository,
	rdb *redis.Client,
	reload SettingsReloadFunc,
	logger *zap.Logger,
) *SettingsHandler {
	return &SettingsHandler{
		entityRepo: entityRepo,
		auditRepo:  auditRepo,
		rdb:        rdb,
		reload:     reload,
		logger:     logger,
	}
}

// logAudit writes an audit entry, surfacing errors to the logger so they
// don't get silently dropped (FIX B4 — every prior call ignored the error).
func (h *SettingsHandler) logAudit(ctx context.Context, entry *adminModel.AuditLog) {
	if err := h.auditRepo.Log(ctx, entry); err != nil {
		h.logger.Error("audit_log_failed",
			zap.String("action", entry.Action),
			zap.String("entity_type", entry.EntityType),
			zap.Int64p("entity_id", entry.EntityID),
			zap.Error(err),
		)
	}
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
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Value) == 0 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Body must include a JSON 'value' field"))
		return
	}

	// Validate value is parseable JSON (not just bytes).
	var probe interface{}
	if err := json.Unmarshal(body.Value, &probe); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Value must be valid JSON"))
		return
	}

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.UpdateSetting(r.Context(), key, string(body.Value), session.AdminID); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_setting")
		return
	}

	// Reload settings cache so consumers (allocation engine) see the new
	// value immediately. If reload fails, we still return success — the DB
	// write committed and a future restart will pick it up.
	if h.reload != nil {
		if err := h.reload(r.Context()); err != nil {
			h.logger.Warn("settings reload failed after update",
				zap.String("key", key), zap.Error(err))
		}
	}

	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update", EntityType: "system_setting",
		NewValue:  map[string]string{"key": key, "value": string(body.Value)},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "setting updated"})
}

// ─── Notices (Postgres-backed; Redis is read-through cache) ───
//
// Storage model: `notices` table is the source of truth. After every write
// the cache key `app:notices` is rebuilt with active notices ordered by
// sort_order. The public Mini App reads the cache key (filtered to active
// notices only). The admin endpoints below operate on the table directly.

const noticesCacheKey = "app:notices"

// rebuildNoticesCache reloads active notices from Postgres into Redis. Called
// after every write so the public endpoint sees fresh data without an extra
// trip to Postgres on the hot path.
func (h *SettingsHandler) rebuildNoticesCache(ctx context.Context) error {
	notices, err := h.entityRepo.ListNoticesActive(ctx)
	if err != nil {
		return err
	}
	data, err := json.Marshal(notices)
	if err != nil {
		return err
	}
	return h.rdb.Set(ctx, noticesCacheKey, data, 0).Err()
}

func (h *SettingsHandler) HandleListNotices(w http.ResponseWriter, r *http.Request) {
	notices, err := h.entityRepo.ListNoticesAll(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_notices")
		return
	}
	if notices == nil {
		notices = []repository.Notice{}
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"notices": notices})
}

// HandleCreateNotice creates a single notice and rebuilds the cache.
// Body shape: { id?, text, text_fa, type, link?, active, sort_order? }
func (h *SettingsHandler) HandleCreateNotice(w http.ResponseWriter, r *http.Request) {
	var notice repository.Notice
	if err := json.NewDecoder(r.Body).Decode(&notice); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	if notice.Text == "" || notice.TextFa == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("text and text_fa required"))
		return
	}
	if notice.Type == "" {
		notice.Type = "info"
	}
	if notice.Type != "info" && notice.Type != "warning" && notice.Type != "promo" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("type must be info|warning|promo"))
		return
	}
	if notice.ID == "" {
		notice.ID = "n_" + strconv.FormatInt(adminMW.GetAdminUserID(r.Context()), 10) + "_" + strconv.FormatInt(timeNowUnixNano(), 10)
	}

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.CreateNotice(r.Context(), &notice, session.AdminID); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "create_notice")
		return
	}
	if err := h.rebuildNoticesCache(r.Context()); err != nil {
		h.logger.Warn("notices cache rebuild failed", zap.Error(err))
	}
	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "create", EntityType: "notice",
		NewValue:  notice,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	httputil.WriteJSON(w, http.StatusCreated, notice)
}

// HandleUpdateNotice updates a single notice by id.
func (h *SettingsHandler) HandleUpdateNotice(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var notice repository.Notice
	if err := json.NewDecoder(r.Body).Decode(&notice); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	notice.ID = id
	if notice.Type != "" && notice.Type != "info" && notice.Type != "warning" && notice.Type != "promo" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("type must be info|warning|promo"))
		return
	}

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.UpdateNotice(r.Context(), &notice); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "update_notice")
		return
	}
	if err := h.rebuildNoticesCache(r.Context()); err != nil {
		h.logger.Warn("notices cache rebuild failed", zap.Error(err))
	}
	entityID := int64(0)
	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update", EntityType: "notice", EntityID: &entityID,
		NewValue:  notice,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	httputil.WriteJSON(w, http.StatusOK, notice)
}

// HandleDeleteNotice removes a notice by id.
func (h *SettingsHandler) HandleDeleteNotice(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.DeleteNotice(r.Context(), id); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "delete_notice")
		return
	}
	if err := h.rebuildNoticesCache(r.Context()); err != nil {
		h.logger.Warn("notices cache rebuild failed", zap.Error(err))
	}
	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "delete", EntityType: "notice",
		NewValue:  map[string]string{"id": id},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "notice deleted"})
}

// HandleReorderNotices accepts an ordered list of notice IDs and updates
// sort_order accordingly. Atomic via a single UPDATE.
func (h *SettingsHandler) HandleReorderNotices(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("ids required"))
		return
	}
	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.ReorderNotices(r.Context(), body.IDs); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "reorder_notices")
		return
	}
	if err := h.rebuildNoticesCache(r.Context()); err != nil {
		h.logger.Warn("notices cache rebuild failed", zap.Error(err))
	}
	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reorder", EntityType: "notice",
		NewValue:  map[string][]string{"ids": body.IDs},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "notices reordered"})
}

// HandleSaveNotices is the legacy "replace all" endpoint. Kept for backward
// compatibility with the existing admin frontend until it migrates to the
// per-record endpoints. Validates and writes to the table in a single tx.
func (h *SettingsHandler) HandleSaveNotices(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}
	var notices []repository.Notice
	if err := json.Unmarshal(body, &notices); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Body must be a JSON array of notices"))
		return
	}
	for i := range notices {
		if notices[i].Type == "" {
			notices[i].Type = "info"
		}
		if notices[i].Type != "info" && notices[i].Type != "warning" && notices[i].Type != "promo" {
			appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("type must be info|warning|promo"))
			return
		}
		if notices[i].ID == "" {
			notices[i].ID = "n_" + strconv.FormatInt(timeNowUnixNano()+int64(i), 10)
		}
		notices[i].SortOrder = i
	}

	session := adminMW.GetAdminSession(r.Context())
	if err := h.entityRepo.ReplaceNotices(r.Context(), notices, session.AdminID); err != nil {
		httputil.HandleServiceError(w, err, h.logger, "replace_notices")
		return
	}
	if err := h.rebuildNoticesCache(r.Context()); err != nil {
		h.logger.Warn("notices cache rebuild failed", zap.Error(err))
	}
	h.logAudit(r.Context(), &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "replace", EntityType: "notices",
		NewValue:  map[string]int{"count": len(notices)},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "notices saved"})
}

// ─── Audit Trail ───

// HandleListAuditLogs returns paginated audit log entries. Supports filtering
// by entity_type, admin_id, and action via query params.
func (h *SettingsHandler) HandleListAuditLogs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	logs, total, err := h.auditRepo.GetPaginated(r.Context(), offset, limit)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "list_audit")
		return
	}
	if logs == nil {
		logs = []adminModel.AuditLog{}
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"logs":  logs,
		"total": total,
	})
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

// timeNowUnixNano is a small indirection to keep handler files free of direct
// time imports for testability. Defined in helpers.go.

