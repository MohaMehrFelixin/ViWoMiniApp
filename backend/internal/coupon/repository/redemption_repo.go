package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/viwo-app/mini-coupon/internal/coupon/model"
)

type RedemptionRepository interface {
	Create(ctx context.Context, redemption *model.CouponRedemption) error
	GetByID(ctx context.Context, id int64) (*model.CouponRedemption, error)
	GetByHousehold(ctx context.Context, householdID int64, cursor string, limit int) ([]model.CouponRedemption, string, error)
	GetByHouseholdAndCategory(ctx context.Context, householdID int64, category model.CouponCategory, cursor string, limit int) ([]model.CouponRedemption, string, error)
	GetByNonce(ctx context.Context, nonce string) (*model.CouponRedemption, error)
	UpdateStatus(ctx context.Context, id int64, status string) error
}

type postgresRedemptionRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresRedemptionRepo(pool *pgxpool.Pool) RedemptionRepository {
	return &postgresRedemptionRepo{pool: pool}
}

func (r *postgresRedemptionRepo) Create(ctx context.Context, redemption *model.CouponRedemption) error {
	query := `
		INSERT INTO coupon_redemptions (id, household_id, allocation_id, category, amount,
			coupon_code, distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.pool.Exec(ctx, query,
		redemption.ID, redemption.HouseholdID, redemption.AllocationID,
		string(redemption.Category), redemption.Amount, redemption.CouponCode,
		redemption.DistributionPointID, redemption.RedeemedByMemberID,
		redemption.QRNonce, redemption.Status, redemption.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("redemption_repo: create: %w", err)
	}
	return nil
}

func (r *postgresRedemptionRepo) GetByID(ctx context.Context, id int64) (*model.CouponRedemption, error) {
	query := `
		SELECT id, household_id, allocation_id, category, amount, coupon_code,
		       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
		FROM coupon_redemptions WHERE id = $1`
	var rd model.CouponRedemption
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&rd.ID, &rd.HouseholdID, &rd.AllocationID,
		&rd.Category, &rd.Amount, &rd.CouponCode,
		&rd.DistributionPointID, &rd.RedeemedByMemberID,
		&rd.QRNonce, &rd.Status, &rd.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("redemption_repo: get by id: %w", err)
	}
	return &rd, nil
}

func (r *postgresRedemptionRepo) GetByHousehold(ctx context.Context, householdID int64, cursor string, limit int) ([]model.CouponRedemption, string, error) {
	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = r.pool.Query(ctx, `
			SELECT id, household_id, allocation_id, category, amount, coupon_code,
			       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
			FROM coupon_redemptions WHERE household_id = $1
			ORDER BY created_at DESC, id DESC LIMIT $2`, householdID, limit)
	} else {
		cursorTime, cursorID, parseErr := parseCompositeCursor(cursor)
		if parseErr != nil {
			return nil, "", parseErr
		}
		rows, err = r.pool.Query(ctx, `
			SELECT id, household_id, allocation_id, category, amount, coupon_code,
			       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
			FROM coupon_redemptions
			WHERE household_id = $1 AND (created_at, id) < ($2, $3)
			ORDER BY created_at DESC, id DESC LIMIT $4`, householdID, cursorTime, cursorID, limit)
	}
	if err != nil {
		return nil, "", fmt.Errorf("redemption_repo: get by household: %w", err)
	}
	defer rows.Close()
	return scanRedemptionRows(rows)
}

func (r *postgresRedemptionRepo) GetByHouseholdAndCategory(ctx context.Context, householdID int64, category model.CouponCategory, cursor string, limit int) ([]model.CouponRedemption, string, error) {
	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = r.pool.Query(ctx, `
			SELECT id, household_id, allocation_id, category, amount, coupon_code,
			       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
			FROM coupon_redemptions WHERE household_id = $1 AND category = $2
			ORDER BY created_at DESC, id DESC LIMIT $3`, householdID, string(category), limit)
	} else {
		cursorTime, cursorID, parseErr := parseCompositeCursor(cursor)
		if parseErr != nil {
			return nil, "", parseErr
		}
		rows, err = r.pool.Query(ctx, `
			SELECT id, household_id, allocation_id, category, amount, coupon_code,
			       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
			FROM coupon_redemptions
			WHERE household_id = $1 AND category = $2 AND (created_at, id) < ($3, $4)
			ORDER BY created_at DESC, id DESC LIMIT $5`, householdID, string(category), cursorTime, cursorID, limit)
	}
	if err != nil {
		return nil, "", fmt.Errorf("redemption_repo: get by household+category: %w", err)
	}
	defer rows.Close()
	return scanRedemptionRows(rows)
}

func (r *postgresRedemptionRepo) GetByNonce(ctx context.Context, nonce string) (*model.CouponRedemption, error) {
	query := `
		SELECT id, household_id, allocation_id, category, amount, coupon_code,
		       distribution_point_id, redeemed_by_member_id, qr_nonce, status, created_at
		FROM coupon_redemptions WHERE qr_nonce = $1`
	var rd model.CouponRedemption
	err := r.pool.QueryRow(ctx, query, nonce).Scan(
		&rd.ID, &rd.HouseholdID, &rd.AllocationID,
		&rd.Category, &rd.Amount, &rd.CouponCode,
		&rd.DistributionPointID, &rd.RedeemedByMemberID,
		&rd.QRNonce, &rd.Status, &rd.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("redemption_repo: get by nonce: %w", err)
	}
	return &rd, nil
}

func (r *postgresRedemptionRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE coupon_redemptions SET status = $1 WHERE id = $2`, status, id)
	if err != nil {
		return fmt.Errorf("redemption_repo: update status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("redemption_repo: redemption %d not found", id)
	}
	return nil
}

func scanRedemptionRows(rows pgx.Rows) ([]model.CouponRedemption, string, error) {
	result := make([]model.CouponRedemption, 0)
	for rows.Next() {
		var rd model.CouponRedemption
		if err := rows.Scan(
			&rd.ID, &rd.HouseholdID, &rd.AllocationID,
			&rd.Category, &rd.Amount, &rd.CouponCode,
			&rd.DistributionPointID, &rd.RedeemedByMemberID,
			&rd.QRNonce, &rd.Status, &rd.CreatedAt,
		); err != nil {
			return nil, "", fmt.Errorf("redemption_repo: scan: %w", err)
		}
		result = append(result, rd)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	var nextCursor string
	if len(result) > 0 {
		last := result[len(result)-1]
		nextCursor = fmt.Sprintf("%s|%d", last.CreatedAt.Format(time.RFC3339Nano), last.ID)
	}
	return result, nextCursor, nil
}

func parseCompositeCursor(cursor string) (time.Time, int64, error) {
	parts := strings.SplitN(cursor, "|", 2)
	if len(parts) != 2 {
		t, err := time.Parse(time.RFC3339Nano, cursor)
		return t, 0, err
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, 0, err
	}
	id, err := strconv.ParseInt(parts[1], 10, 64)
	return t, id, err
}
