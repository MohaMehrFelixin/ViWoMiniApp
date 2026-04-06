package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/viwo-app/mini-coupon/internal/coupon/model"
)

type PowerBankRepository interface {
	Create(ctx context.Context, swap *model.PowerBankSwap) error
	GetByID(ctx context.Context, id int64) (*model.PowerBankSwap, error)
	GetActiveByHousehold(ctx context.Context, householdID int64) (*model.PowerBankSwap, error)
	GetByHousehold(ctx context.Context, householdID int64) ([]model.PowerBankSwap, error)
	UpdateStatus(ctx context.Context, id int64, status string) error
	PickUp(ctx context.Context, id int64) error
	Return(ctx context.Context, id int64) error
}

type postgresPowerBankRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresPowerBankRepo(pool *pgxpool.Pool) PowerBankRepository {
	return &postgresPowerBankRepo{pool: pool}
}

func (r *postgresPowerBankRepo) Create(ctx context.Context, swap *model.PowerBankSwap) error {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		INSERT INTO power_bank_swaps (id, household_id, member_id, status, swap_code, center_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at`

	return r.pool.QueryRow(ctx, query,
		swap.ID, swap.HouseholdID, swap.MemberID, swap.Status, swap.SwapCode, swap.CenterID,
	).Scan(&swap.CreatedAt, &swap.UpdatedAt)
}

func (r *postgresPowerBankRepo) GetByID(ctx context.Context, id int64) (*model.PowerBankSwap, error) {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT id, household_id, member_id, status, swap_code, center_id,
		       picked_up_at, returned_at, created_at, updated_at
		FROM power_bank_swaps WHERE id = $1`

	var s model.PowerBankSwap
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.HouseholdID, &s.MemberID, &s.Status, &s.SwapCode, &s.CenterID,
		&s.PickedUpAt, &s.ReturnedAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("powerbank_repo: get by id: %w", err)
	}
	return &s, nil
}

func (r *postgresPowerBankRepo) GetActiveByHousehold(ctx context.Context, householdID int64) (*model.PowerBankSwap, error) {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT id, household_id, member_id, status, swap_code, center_id,
		       picked_up_at, returned_at, created_at, updated_at
		FROM power_bank_swaps
		WHERE household_id = $1 AND status IN ('pending', 'ready', 'picked_up')
		ORDER BY created_at DESC LIMIT 1`

	var s model.PowerBankSwap
	err := r.pool.QueryRow(ctx, query, householdID).Scan(
		&s.ID, &s.HouseholdID, &s.MemberID, &s.Status, &s.SwapCode, &s.CenterID,
		&s.PickedUpAt, &s.ReturnedAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("powerbank_repo: get active: %w", err)
	}
	return &s, nil
}

func (r *postgresPowerBankRepo) GetByHousehold(ctx context.Context, householdID int64) ([]model.PowerBankSwap, error) {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT id, household_id, member_id, status, swap_code, center_id,
		       picked_up_at, returned_at, created_at, updated_at
		FROM power_bank_swaps
		WHERE household_id = $1
		ORDER BY created_at DESC LIMIT 20`

	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("powerbank_repo: list: %w", err)
	}
	defer rows.Close()

	swaps := make([]model.PowerBankSwap, 0)
	for rows.Next() {
		var s model.PowerBankSwap
		if err := rows.Scan(
			&s.ID, &s.HouseholdID, &s.MemberID, &s.Status, &s.SwapCode, &s.CenterID,
			&s.PickedUpAt, &s.ReturnedAt, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("powerbank_repo: scan: %w", err)
		}
		swaps = append(swaps, s)
	}
	return swaps, rows.Err()
}

func (r *postgresPowerBankRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE power_bank_swaps SET status = $1 WHERE id = $2", status, id)
	if err != nil {
		return fmt.Errorf("powerbank_repo: update status: %w", err)
	}
	return nil
}

func (r *postgresPowerBankRepo) PickUp(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE power_bank_swaps SET status = 'picked_up', picked_up_at = NOW() WHERE id = $1 AND status IN ('pending','ready')", id)
	if err != nil {
		return fmt.Errorf("powerbank_repo: pick up: %w", err)
	}
	return nil
}

func (r *postgresPowerBankRepo) Return(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE power_bank_swaps SET status = 'returned', returned_at = NOW() WHERE id = $1 AND status = 'picked_up'", id)
	if err != nil {
		return fmt.Errorf("powerbank_repo: return: %w", err)
	}
	return nil
}
