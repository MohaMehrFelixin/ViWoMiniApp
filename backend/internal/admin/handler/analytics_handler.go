package handler

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"go.uber.org/zap"

	"github.com/viwo-app/mini-coupon/internal/admin/repository"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
)

// AnalyticsHandler serves chart data and CSV exports.
type AnalyticsHandler struct {
	repo   *repository.EntityRepository
	logger *zap.Logger
}

func NewAnalyticsHandler(repo *repository.EntityRepository, logger *zap.Logger) *AnalyticsHandler {
	return &AnalyticsHandler{repo: repo, logger: logger}
}

func (h *AnalyticsHandler) HandleRedemptionsByDay(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 90 {
		days = 30
	}
	data, err := h.repo.GetRedemptionsByDay(r.Context(), days)
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "redemptions_by_day")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": data})
}

func (h *AnalyticsHandler) HandleCategoryDistribution(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.GetCategoryDistribution(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "category_distribution")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": data})
}

func (h *AnalyticsHandler) HandleCenterUtilization(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.GetCenterUtilization(r.Context())
	if err != nil {
		httputil.HandleServiceError(w, err, h.logger, "center_utilization")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"data": data})
}

// ─── CSV Exports ───

func (h *AnalyticsHandler) HandleExportHouseholds(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.ExportHouseholdsCSV(r.Context())
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrInternalServer)
		return
	}
	writeCSV(w, "households.csv", data)
}

func (h *AnalyticsHandler) HandleExportRedemptions(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.ExportRedemptionsCSV(r.Context())
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrInternalServer)
		return
	}
	writeCSV(w, "redemptions.csv", data)
}

func writeCSV(w http.ResponseWriter, filename string, rows [][]string) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	writer := csv.NewWriter(w)
	for _, row := range rows {
		_ = writer.Write(row)
	}
	writer.Flush()
}
