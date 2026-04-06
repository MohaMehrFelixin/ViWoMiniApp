package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type AppError struct {
	Code       string      `json:"code"`
	Message    string      `json:"message"`
	HTTPStatus int         `json:"-"`
	Details    interface{} `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *AppError) WithDetails(details interface{}) *AppError {
	return &AppError{Code: e.Code, Message: e.Message, HTTPStatus: e.HTTPStatus, Details: details}
}

func (e *AppError) WithMessage(msg string) *AppError {
	return &AppError{Code: e.Code, Message: msg, HTTPStatus: e.HTTPStatus, Details: e.Details}
}

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

var (
	ErrUnauthorized        = &AppError{Code: "UNAUTHORIZED", Message: "Authentication required", HTTPStatus: http.StatusUnauthorized}
	ErrForbidden           = &AppError{Code: "FORBIDDEN", Message: "You do not have permission", HTTPStatus: http.StatusForbidden}
	ErrNotFound            = &AppError{Code: "NOT_FOUND", Message: "Resource not found", HTTPStatus: http.StatusNotFound}
	ErrBadRequest          = &AppError{Code: "BAD_REQUEST", Message: "The request is invalid", HTTPStatus: http.StatusBadRequest}
	ErrInternalServer      = &AppError{Code: "INTERNAL_ERROR", Message: "An unexpected error occurred", HTTPStatus: http.StatusInternalServerError}
	ErrInsufficientBalance = &AppError{Code: "INSUFFICIENT_BALANCE", Message: "Insufficient balance", HTTPStatus: http.StatusUnprocessableEntity}
	ErrConflict            = &AppError{Code: "CONFLICT", Message: "Conflict with current state", HTTPStatus: http.StatusConflict}
	ErrDuplicateEntry      = &AppError{Code: "DUPLICATE_ENTRY", Message: "Resource already exists", HTTPStatus: http.StatusConflict}
	ErrRateLimited         = &AppError{Code: "RATE_LIMITED", Message: "Too many requests", HTTPStatus: http.StatusTooManyRequests}
	ErrServiceUnavailable  = &AppError{Code: "SERVICE_UNAVAILABLE", Message: "Service temporarily unavailable", HTTPStatus: http.StatusServiceUnavailable}
)

func WriteJSON(w http.ResponseWriter, err *AppError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.HTTPStatus)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		Error: ErrorBody{Code: err.Code, Message: err.Message, Details: err.Details},
	})
}
