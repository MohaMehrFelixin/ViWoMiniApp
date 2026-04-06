package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/viwo-app/mini-coupon/internal/coupon/model"
)

type HouseholdRepository interface {
	Create(ctx context.Context, household *model.Household) error
	GetByID(ctx context.Context, id int64) (*model.Household, error)
	GetByTelegramUserID(ctx context.Context, telegramUserID int64) (*model.Household, error)
	AddMember(ctx context.Context, member *model.HouseholdMember) error
	GetMembers(ctx context.Context, householdID int64) ([]model.HouseholdMember, error)
	GetMemberByNationalCode(ctx context.Context, code string) (*model.HouseholdMember, error)
	UpdateKYCTier(ctx context.Context, householdID int64, tier int) error
}

type postgresHouseholdRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresHouseholdRepo(pool *pgxpool.Pool) HouseholdRepository {
	return &postgresHouseholdRepo{pool: pool}
}

func (r *postgresHouseholdRepo) Create(ctx context.Context, household *model.Household) error {
	query := `
		INSERT INTO households (id, telegram_user_id, household_code, kyc_tier, address, lat, lng, province_code, location_segment, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		household.ID, household.TelegramUserID, household.HouseholdCode,
		household.KYCTier, household.Address, household.Lat, household.Lng,
		household.ProvinceCode, household.LocationSegment, household.Status,
	).Scan(&household.CreatedAt, &household.UpdatedAt)
}

func (r *postgresHouseholdRepo) GetByID(ctx context.Context, id int64) (*model.Household, error) {
	query := `
		SELECT id, telegram_user_id, household_code, kyc_tier, address, lat, lng,
		       province_code, location_segment, status, created_at, updated_at
		FROM households WHERE id = $1`
	var h model.Household
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier,
		&h.Address, &h.Lat, &h.Lng, &h.ProvinceCode,
		&h.LocationSegment, &h.Status, &h.CreatedAt, &h.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("household_repo: get by id: %w", err)
	}
	return &h, nil
}

func (r *postgresHouseholdRepo) GetByTelegramUserID(ctx context.Context, telegramUserID int64) (*model.Household, error) {
	query := `
		SELECT id, telegram_user_id, household_code, kyc_tier, address, lat, lng,
		       province_code, location_segment, status, created_at, updated_at
		FROM households WHERE telegram_user_id = $1`
	var h model.Household
	err := r.pool.QueryRow(ctx, query, telegramUserID).Scan(
		&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier,
		&h.Address, &h.Lat, &h.Lng, &h.ProvinceCode,
		&h.LocationSegment, &h.Status, &h.CreatedAt, &h.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("household_repo: get by telegram_user_id: %w", err)
	}
	return &h, nil
}

func (r *postgresHouseholdRepo) AddMember(ctx context.Context, member *model.HouseholdMember) error {
	query := `
		INSERT INTO household_members (id, household_id, national_code, full_name, birth_date, gender, relationship, age_group, special_flags, kyc_verified)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at`
	return r.pool.QueryRow(ctx, query,
		member.ID, member.HouseholdID, member.NationalCode,
		member.FullName, member.BirthDate, member.Gender,
		member.Relationship, member.AgeGroup, member.SpecialFlags, member.KYCVerified,
	).Scan(&member.CreatedAt)
}

func (r *postgresHouseholdRepo) GetMembers(ctx context.Context, householdID int64) ([]model.HouseholdMember, error) {
	query := `
		SELECT id, household_id, national_code, full_name, birth_date, gender,
		       relationship, age_group, special_flags, kyc_verified, created_at
		FROM household_members WHERE household_id = $1 ORDER BY created_at ASC LIMIT 100`
	rows, err := r.pool.Query(ctx, query, householdID)
	if err != nil {
		return nil, fmt.Errorf("household_repo: get members: %w", err)
	}
	defer rows.Close()

	members := make([]model.HouseholdMember, 0)
	for rows.Next() {
		var m model.HouseholdMember
		if err := rows.Scan(&m.ID, &m.HouseholdID, &m.NationalCode, &m.FullName,
			&m.BirthDate, &m.Gender, &m.Relationship, &m.AgeGroup,
			&m.SpecialFlags, &m.KYCVerified, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("household_repo: scan member: %w", err)
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (r *postgresHouseholdRepo) GetMemberByNationalCode(ctx context.Context, code string) (*model.HouseholdMember, error) {
	query := `
		SELECT id, household_id, national_code, full_name, birth_date, gender,
		       relationship, age_group, special_flags, kyc_verified, created_at
		FROM household_members WHERE national_code = $1`
	var m model.HouseholdMember
	err := r.pool.QueryRow(ctx, query, code).Scan(
		&m.ID, &m.HouseholdID, &m.NationalCode, &m.FullName,
		&m.BirthDate, &m.Gender, &m.Relationship, &m.AgeGroup,
		&m.SpecialFlags, &m.KYCVerified, &m.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("household_repo: get by national_code: %w", err)
	}
	return &m, nil
}

func (r *postgresHouseholdRepo) UpdateKYCTier(ctx context.Context, householdID int64, tier int) error {
	tag, err := r.pool.Exec(ctx, `UPDATE households SET kyc_tier = $1 WHERE id = $2`, tier, householdID)
	if err != nil {
		return fmt.Errorf("household_repo: update kyc tier: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("household_repo: household %d not found", householdID)
	}
	return nil
}
