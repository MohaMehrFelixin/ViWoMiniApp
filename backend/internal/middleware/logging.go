package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

const RequestIDHeader = "X-Request-ID"

type requestIDKeyType string

const requestIDCtxKey requestIDKeyType = "request_id"

func GetRequestID(r *http.Request) string {
	id, _ := r.Context().Value(requestIDCtxKey).(string)
	return id
}

type wrappedWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *wrappedWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func RequestLogging(logger *zap.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			reqID := r.Header.Get(RequestIDHeader)
			if reqID == "" {
				reqID = uuid.New().String()
			}
			ctx := context.WithValue(r.Context(), requestIDCtxKey, reqID)
			r = r.WithContext(ctx)
			w.Header().Set(RequestIDHeader, reqID)

			wrapped := &wrappedWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(wrapped, r)

			logger.Info("http_request",
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.Int("status", wrapped.statusCode),
				zap.Float64("latency_ms", float64(time.Since(start).Microseconds())/1000.0),
				zap.Int64("tg_user_id", GetTelegramUserID(r.Context())),
				zap.String("request_id", reqID),
				zap.String("ip", r.RemoteAddr),
			)
		})
	}
}
