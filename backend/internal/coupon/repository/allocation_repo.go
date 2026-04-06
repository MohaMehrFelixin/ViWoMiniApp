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

func ensureTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if _, ok := ctx.Deadline(); ok {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, timeout)
}

type AllocationRepository interface {
	CreateBatch(ctx context.Context, allocations []model.CouponAllocation) error
	DeleteByHouseholdCycle(ctx context.Context, householdID int64, cycleStart, cycleEnd time.Time) error
	GetByHouseholdAndCategory(ctx context.Context, householdID int64, category model.CouponCategory) (*model.CouponAllocation, error)
	DeductBalance(ctx context.Context, tx pgx.Tx, allocationID int64, amount string) error
	GetCurrentCycleAllocations(ctx context.Context, householdID int64) ([]model.CouponAllocation, error)
}

type postgresAllocationRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresAllocationRepo(pool *pgxpool.Pool) AllocationRepository {
	return &postgresAllocationRepo{pool: pool}
}

func (r *postgresAllocationRepo) CreateBatch(ctx context.Context, allocations []model.CouponAllocation) error {
	if len(allocations) == 0 {
		return nil
	}
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("allocation_repo: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	query := `
		INSERT INTO coupon_allocations (id, household_id, category, cycle_start, cycle_end,
			total_amount, used_amount, remaining_amount,
			weekly_release_pct_1, weekly_release_pct_2, weekly_release_pct_3, weekly_release_pct_4,
			current_week, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING created_at`

	for i := range allocations {
		a := &allocations[i]
		err := tx.QueryRow(ctx, query,
			a.ID, a.HouseholdID, string(a.Category),
			a.CycleStart, a.CycleEnd,
			a.TotalAmount, a.UsedAmount, a.RemainingAmount,
			a.WeeklyReleasePcts[0], a.WeeklyReleasePcts[1],
			a.WeeklyReleasePcts[2], a.WeeklyReleasePcts[3],
			a.CurrentWeek, a.Status,
		).Scan(&a.CreatedAt)
		if err != nil {
			return fmt.Errorf("allocation_repo: create %s: %w", a.Category, err)
		}
	}

	return tx.Commit(ctx)
}

func (r *postgresAllocationRepo) DeleteByHouseholdCycle(ctx context.Context, householdID int64, cycleStart, cycleEnd time.Time) error {
	query := `
		DELETE FROM coupon_allocations
		WHERE household_id = $1
		  AND cycle_start = $2
		  AND cycle_end = $3
		  AND used_amount = 0`
	_, err := r.pool.Exec(ctx, query, householdID, cycleStart, cycleEnd)
	if err != nil {
		return fmt.Errorf("allocation_repo: delete by cycle: %w", err)
	}
	return nil
}

func (r *postgresAllocationRepo) GetByHouseholdAndCategory(ctx context.Context, householdID int64, category model.CouponCategory) (*model.CouponAllocation, error) {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT id, household_id, category, cycle_start, cycle_end,
		       total_amount, used_amount, remaining_amount,
		       weekly_release_pct_1, weekly_release_pct_2, weekly_release_pct_3, weekly_release_pct_4,
		       current_week, status, created_at
		FROM coupon_allocations
		WHERE household_id = $1 AND category = $2 AND status = 'active'
		ORDER BY cycle_start DESC LIMIT 1`

	var a model.CouponAllocation
	err := r.pool.QueryRow(ctx, query, householdID, string(category)).Scan(
		&a.ID, &a.HouseholdID, &a.Category,
		&a.CycleStart, &a.CycleEnd,
		&a.TotalAmount, &a.UsedAmount, &a.RemainingAmount,
		&a.WeeklyReleasePcts[0], &a.WeeklyReleasePcts[1],
		&a.WeeklyReleasePcts[2], &a.WeeklyReleasePcts[3],
		&a.CurrentWeek, &a.Status, &a.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("allocation_repo: get by household+category: %w", err)
	}
	return &a, nil
}

func (r *postgresAllocationRepo) DeductBalance(ctx context.Context, tx pgx.Tx, allocationID int64, amount string) error {
	query := `
		UPDATE coupon_allocations
		SET used_amount = used_amount + $1::NUMERIC,
		    remaining_amount = remaining_amount - $1::NUMERIC
		WHERE id = $2 AND status = 'active' AND remaining_amount >= $1::NUMERIC
		  AND NOW() BETWEEN cycle_start AND cycle_end`

	tag, err := tx.Exec(ctx, query, amount, allocationID)
	if err != nil {
		return fmt.Errorf("allocation_repo: deduct: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("allocation_repo: deduction failed: inactive, expired, or insufficient balance")
	}
	return nil
}

func (r *postgresAllocationRepo) GetCurrentCycleAllocations(ctx context.Context, householdID int64) ([]model.CouponAllocation, error) {
	ctx, cancel := ensureTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT id, household_id, category, cycle_start, cycle_end,
		       total_amount, used_amount, remaining_amount,
		       weekly_release_pct_1, weekly_release_pct_2, weekly_release_pct_3, weekly_release_pct_4,
		       current_week, status, created_at
		FROM coupon_allocations
		WHERE household_id = $1 AND status = 'active' AND NOW() BETWEEN cycle_start AND cycle_end
		ORDER BY category ASC`

	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("allocation_repo: get current cycle: %w", err)
	}
	defer rows.Close()

	allocations := make([]model.CouponAllocation, 0)
	for rows.Next() {
		var a model.CouponAllocation
		if err := rows.Scan(
			&a.ID, &a.HouseholdID, &a.Category,
			&a.CycleStart, &a.CycleEnd,
			&a.TotalAmount, &a.UsedAmount, &a.RemainingAmount,
			&a.WeeklyReleasePcts[0], &a.WeeklyReleasePcts[1],
			&a.WeeklyReleasePcts[2], &a.WeeklyReleasePcts[3],
			&a.CurrentWeek, &a.Status, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("allocation_repo: scan: %w", err)
		}
		allocations = append(allocations, a)
	}
	return allocations, rows.Err()
}
