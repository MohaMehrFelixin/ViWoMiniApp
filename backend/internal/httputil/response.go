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

	// Bridge for classified errors from other packages (e.g., finnotech)
	// that carry HTTP status and error code without importing internal/errors.
	type classified interface {
		HTTPStatusCode() int
		ErrorCode() string
	}
	if ce, ok := err.(classified); ok {
		appErrors.WriteJSON(w, &appErrors.AppError{
			Code:       ce.ErrorCode(),
			Message:    err.Error(),
			HTTPStatus: ce.HTTPStatusCode(),
		})
		return
	}

	logger.Error("unhandled service error", zap.String("operation", operation), zap.Error(err))
	appErrors.WriteJSON(w, appErrors.ErrInternalServer)
}
