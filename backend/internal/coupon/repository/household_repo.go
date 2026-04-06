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

type HouseholdRepository interface {
	Create(ctx context.Context, household *model.Household) error
	GetByID(ctx context.Context, id int64) (*model.Household, error)
	GetByTelegramUserID(ctx context.Context, telegramUserID int64) (*model.Household, error)
	AddMember(ctx context.Context, member *model.HouseholdMember) error
	GetMembers(ctx context.Context, householdID int64) ([]model.HouseholdMember, error)
	GetMemberByNationalCode(ctx context.Context, code string) (*model.HouseholdMember, error)
	UpdateKYCTier(ctx context.Context, householdID int64, tier int) error
	UpdateMember(ctx context.Context, memberID int64, req model.AddMemberRequest) error
	SetMemberKYCVerified(ctx context.Context, memberID int64, verified bool) error
}

type postgresHouseholdRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresHouseholdRepo(pool *pgxpool.Pool) HouseholdRepository {
	return &postgresHouseholdRepo{pool: pool}
}

func (r *postgresHouseholdRepo) Create(ctx context.Context, household *model.Household) error {
	query := `
		INSERT INTO households (id, telegram_user_id, household_code, kyc_tier, phone_number, address, lat, lng, province_code, location_segment, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		household.ID, household.TelegramUserID, household.HouseholdCode,
		household.KYCTier, household.PhoneNumber, household.Address, household.Lat, household.Lng,
		household.ProvinceCode, household.LocationSegment, household.Status,
	).Scan(&household.CreatedAt, &household.UpdatedAt)
}

func (r *postgresHouseholdRepo) GetByID(ctx context.Context, id int64) (*model.Household, error) {
	query := `
		SELECT id, telegram_user_id, household_code, kyc_tier, COALESCE(phone_number, ''), address, lat, lng,
		       province_code, location_segment, status, created_at, updated_at
		FROM households WHERE id = $1`
	var h model.Household
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier,
		&h.PhoneNumber, &h.Address, &h.Lat, &h.Lng, &h.ProvinceCode,
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
		SELECT id, telegram_user_id, household_code, kyc_tier, COALESCE(phone_number, ''), address, lat, lng,
		       province_code, location_segment, status, created_at, updated_at
		FROM households WHERE telegram_user_id = $1`
	var h model.Household
	err := r.pool.QueryRow(ctx, query, telegramUserID).Scan(
		&h.ID, &h.TelegramUserID, &h.HouseholdCode, &h.KYCTier,
		&h.PhoneNumber, &h.Address, &h.Lat, &h.Lng, &h.ProvinceCode,
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

func (r *postgresHouseholdRepo) UpdateMember(ctx context.Context, memberID int64, req model.AddMemberRequest) error {
	// Parse birth_date string to time.Time for PostgreSQL date column
	birthDate, err := time.Parse("2006-01-02", req.BirthDate)
	if err != nil {
		return fmt.Errorf("household_repo: invalid birth date %q: %w", req.BirthDate, err)
	}
	tag, err := r.pool.Exec(ctx,
		`UPDATE household_members SET full_name = $1, gender = $2, birth_date = $3 WHERE id = $4`,
		req.FullName, req.Gender, birthDate, memberID,
	)
	if err != nil {
		return fmt.Errorf("household_repo: update member: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("household_repo: member %d not found", memberID)
	}
	return nil
}

func (r *postgresHouseholdRepo) SetMemberKYCVerified(ctx context.Context, memberID int64, verified bool) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE household_members SET kyc_verified = $1 WHERE id = $2`,
		verified, memberID,
	)
	if err != nil {
		return fmt.Errorf("household_repo: set kyc_verified: %w", err)
	}
	return nil
}
