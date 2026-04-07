package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/httputil"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/idgen"
	"github.com/viwo-app/mini-coupon/internal/middleware"
)

// RegistrationHandler handles volunteer and provider registration from the Mini App.
type RegistrationHandler struct {
	pool   *pgxpool.Pool
	idGen  *idgen.Generator
	logger *zap.Logger
}

func NewRegistrationHandler(pool *pgxpool.Pool, idGen *idgen.Generator, logger *zap.Logger) *RegistrationHandler {
	return &RegistrationHandler{pool: pool, idGen: idGen, logger: logger}
}

// HandleRegisterVolunteer registers the current user as a volunteer.
func (h *RegistrationHandler) HandleRegisterVolunteer(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	var req model.RegisterVolunteerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}

	// Get household for this user
	var householdID int64
	var fullName string
	err := h.pool.QueryRow(r.Context(),
		`SELECT h.id, m.full_name FROM households h
		 JOIN household_members m ON m.household_id = h.id AND m.relationship = 'head'
		 WHERE h.telegram_user_id = $1`, uid).Scan(&householdID, &fullName)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrNotFound.WithMessage("Household not found"))
		return
	}

	// Check if already registered
	var exists bool
	_ = h.pool.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM volunteers WHERE telegram_user_id = $1)", uid).Scan(&exists)
	if exists {
		// Update specialty
		_, _ = h.pool.Exec(r.Context(), "UPDATE volunteers SET specialty = $2 WHERE telegram_user_id = $1", uid, req.Specialty)
		httputil.WriteJSON(w, http.StatusOK, model.VolunteerStatusResponse{
			IsVolunteer: true, Specialty: req.Specialty, Status: "pending",
		})
		return
	}

	id, _ := h.idGen.Generate()
	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO volunteers (id, household_id, telegram_user_id, full_name, specialty, status)
		 VALUES ($1, $2, $3, $4, $5, 'pending')`,
		id, householdID, uid, fullName, req.Specialty)
	if err != nil {
		h.logger.Error("register volunteer", zap.Error(err))
		appErrors.WriteJSON(w, appErrors.ErrInternalServer)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, model.VolunteerStatusResponse{
		IsVolunteer: true, Specialty: req.Specialty, Status: "pending",
	})
}

// HandleGetVolunteerStatus returns the current user's volunteer status.
func (h *RegistrationHandler) HandleGetVolunteerStatus(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	var specialty, status string
	err := h.pool.QueryRow(r.Context(),
		"SELECT COALESCE(specialty, ''), status FROM volunteers WHERE telegram_user_id = $1", uid).
		Scan(&specialty, &status)
	if err != nil {
		httputil.WriteJSON(w, http.StatusOK, model.VolunteerStatusResponse{IsVolunteer: false, Status: "none"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, model.VolunteerStatusResponse{
		IsVolunteer: true, Specialty: specialty, Status: status,
	})
}

// HandleRegisterProvider registers the current user as a provider/distributor.
func (h *RegistrationHandler) HandleRegisterProvider(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	var req model.RegisterProviderApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}

	// Get household + head member
	var householdID int64
	var fullName string
	err := h.pool.QueryRow(r.Context(),
		`SELECT h.id, m.full_name FROM households h
		 JOIN household_members m ON m.household_id = h.id AND m.relationship = 'head'
		 WHERE h.telegram_user_id = $1`, uid).Scan(&householdID, &fullName)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrNotFound.WithMessage("Household not found"))
		return
	}

	// Look up service type
	var serviceTypeID int64
	err = h.pool.QueryRow(r.Context(),
		"SELECT id FROM provider_service_types WHERE code = $1 AND is_active = true", req.ServiceTypeCode).
		Scan(&serviceTypeID)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest.WithMessage("Invalid service type"))
		return
	}

	// Check if already registered
	var existingID int64
	err = h.pool.QueryRow(r.Context(), "SELECT id FROM providers WHERE telegram_user_id = $1", uid).Scan(&existingID)
	if err == nil {
		// Already registered — update
		_, _ = h.pool.Exec(r.Context(),
			`UPDATE providers SET service_type_id = $2, store_address = $3, store_description = $4, lat = $5, lng = $6 WHERE id = $1`,
			existingID, serviceTypeID, req.StoreAddress, req.StoreDescription, req.Lat, req.Lng)
		httputil.WriteJSON(w, http.StatusOK, model.ProviderStatusResponse{
			IsProvider: true, Status: "pending", ServiceType: req.ServiceTypeCode,
		})
		return
	}

	id, _ := h.idGen.Generate()
	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO providers (id, telegram_user_id, household_id, name, name_fa, service_type_id,
		 store_address, store_description, lat, lng, status)
		 VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, 'pending')`,
		id, uid, householdID, fullName, serviceTypeID, req.StoreAddress, req.StoreDescription, req.Lat, req.Lng)
	if err != nil {
		h.logger.Error("register provider", zap.Error(err))
		appErrors.WriteJSON(w, appErrors.ErrInternalServer.WithMessage(fmt.Sprintf("registration failed: %v", err)))
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, model.ProviderStatusResponse{
		IsProvider: true, Status: "pending", ServiceType: req.ServiceTypeCode,
	})
}

// HandleGetProviderStatus returns the current user's provider status.
func (h *RegistrationHandler) HandleGetProviderStatus(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	var status, serviceCode string
	err := h.pool.QueryRow(r.Context(),
		`SELECT p.status, s.code FROM providers p
		 JOIN provider_service_types s ON p.service_type_id = s.id
		 WHERE p.telegram_user_id = $1`, uid).
		Scan(&status, &serviceCode)
	if err != nil {
		httputil.WriteJSON(w, http.StatusOK, model.ProviderStatusResponse{IsProvider: false, Status: "none"})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, model.ProviderStatusResponse{
		IsProvider: true, Status: status, ServiceType: serviceCode,
	})
}

// HandleSubmitProductOfferings submits product offerings from the KYC flow.
func (h *RegistrationHandler) HandleSubmitProductOfferings(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetTelegramUserID(r.Context())
	if uid == 0 {
		appErrors.WriteJSON(w, appErrors.ErrUnauthorized)
		return
	}

	var req model.SubmitProductOfferingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		appErrors.WriteJSON(w, appErrors.ErrBadRequest)
		return
	}

	var householdID int64
	err := h.pool.QueryRow(r.Context(), "SELECT id FROM households WHERE telegram_user_id = $1", uid).Scan(&householdID)
	if err != nil {
		appErrors.WriteJSON(w, appErrors.ErrNotFound.WithMessage("Household not found"))
		return
	}

	ctx := r.Context()
	for _, item := range req.Offerings {
		id, _ := h.idGen.Generate()
		_, err := h.pool.Exec(ctx,
			`INSERT INTO product_offerings (id, household_id, telegram_user_id, product_name, product_name_fa, quantity, unit, description, status)
			 VALUES ($1, $2, $3, $4, $5, $6::NUMERIC, $7, $8, 'pending')`,
			id, householdID, uid, item.ProductName, item.ProductNameFa, item.Quantity, item.Unit, item.Description)
		if err != nil {
			h.logger.Error("submit offering", zap.Error(err))
		}
	}

	httputil.WriteJSON(w, http.StatusCreated, map[string]string{"message": "offerings submitted"})
}

// requireHouseholdID is a helper to get the household ID for the current TG user.
func requireHouseholdID(ctx context.Context, pool *pgxpool.Pool, uid int64) (int64, error) {
	var id int64
	err := pool.QueryRow(ctx, "SELECT id FROM households WHERE telegram_user_id = $1", uid).Scan(&id)
	return id, err
}
