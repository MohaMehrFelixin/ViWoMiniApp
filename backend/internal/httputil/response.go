package httputil

import (
	"encoding/json"
	"net/http"

	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func HandleServiceError(w http.ResponseWriter, err error, logger *zap.Logger, operation string) {
	if appErr, ok := err.(*appErrors.AppError); ok {
		appErrors.WriteJSON(w, appErr)
		return
	}
	logger.Error("unhandled service error", zap.String("operation", operation), zap.Error(err))
	appErrors.WriteJSON(w, appErrors.ErrInternalServer)
}
