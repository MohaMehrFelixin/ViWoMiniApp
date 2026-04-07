package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
)

// AdminRepository defines data access operations for admin users.
type AdminRepository interface {
	GetByID(ctx context.Context, id int64) (*adminModel.AdminUser, error)
	GetByNationalCode(ctx context.Context, nationalCode string) (*adminModel.AdminUser, error)
	Create(ctx context.Context, admin *adminModel.AdminUser) error
	Update(ctx context.Context, admin *adminModel.AdminUser) error
	UpdateStatus(ctx context.Context, id int64, status string) error
	UpdateLastLogin(ctx context.Context, id int64, ip string) error
	IncrementFailedAttempts(ctx context.Context, id int64) error
	ClearFailedAttempts(ctx context.Context, id int64) error
	GetPaginated(ctx context.Context, offset, limit int) ([]adminModel.AdminUser, int, error)
	GetByParent(ctx context.Context, parentID int64) ([]adminModel.AdminUser, error)
}

type postgresAdminRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresAdminRepo creates a new PostgreSQL-backed admin repository.
func NewPostgresAdminRepo(pool *pgxpool.Pool) AdminRepository {
	return &postgresAdminRepo{pool: pool}
}

func (r *postgresAdminRepo) GetByID(ctx context.Context, id int64) (*adminModel.AdminUser, error) {
	return r.scanOne(ctx, "id = $1", id)
}

func (r *postgresAdminRepo) GetByNationalCode(ctx context.Context, nationalCode string) (*adminModel.AdminUser, error) {
	return r.scanOne(ctx, "national_code = $1", nationalCode)
}

func (r *postgresAdminRepo) Create(ctx context.Context, admin *adminModel.AdminUser) error {
	query := `
		INSERT INTO admin_users (id, national_code, full_name, phone, birth_date, gender,
			role_level, role_title, province_codes, parent_admin_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.pool.Exec(ctx, query,
		admin.ID, admin.NationalCode, admin.FullName, admin.Phone,
		admin.BirthDate, admin.Gender,
		admin.RoleLevel, admin.RoleTitle, admin.ProvinceCodes,
		admin.ParentAdminID, admin.Status,
	)
	if err != nil {
		return fmt.Errorf("admin_repo: create: %w", err)
	}
	return nil
}

func (r *postgresAdminRepo) Update(ctx context.Context, admin *adminModel.AdminUser) error {
	query := `
		UPDATE admin_users SET
			full_name = $2, phone = $3, role_level = $4, role_title = $5,
			province_codes = $6, status = $7
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query,
		admin.ID, admin.FullName, admin.Phone,
		admin.RoleLevel, admin.RoleTitle, admin.ProvinceCodes, admin.Status,
	)
	if err != nil {
		return fmt.Errorf("admin_repo: update: %w", err)
	}
	return nil
}

func (r *postgresAdminRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
	_, err := r.pool.Exec(ctx, "UPDATE admin_users SET status = $2 WHERE id = $1", id, status)
	return err
}

func (r *postgresAdminRepo) UpdateLastLogin(ctx context.Context, id int64, ip string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE admin_users SET last_login_at = NOW(), last_login_ip = $2, failed_attempts = 0 WHERE id = $1",
		id, ip,
	)
	return err
}

func (r *postgresAdminRepo) IncrementFailedAttempts(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, "UPDATE admin_users SET failed_attempts = failed_attempts + 1 WHERE id = $1", id)
	return err
}

func (r *postgresAdminRepo) ClearFailedAttempts(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, "UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", id)
	return err
}

func (r *postgresAdminRepo) GetPaginated(ctx context.Context, offset, limit int) ([]adminModel.AdminUser, int, error) {
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM admin_users").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("admin_repo: count: %w", err)
	}

	rows, err := r.pool.Query(ctx,
		"SELECT "+adminSelectCols+" FROM admin_users ORDER BY role_level DESC, created_at ASC LIMIT $1 OFFSET $2",
		limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("admin_repo: list: %w", err)
	}
	defer rows.Close()

	var admins []adminModel.AdminUser
	for rows.Next() {
		a, err := scanAdmin(rows)
		if err != nil {
			return nil, 0, err
		}
		admins = append(admins, *a)
	}
	return admins, total, nil
}

func (r *postgresAdminRepo) GetByParent(ctx context.Context, parentID int64) ([]adminModel.AdminUser, error) {
	rows, err := r.pool.Query(ctx,
		"SELECT "+adminSelectCols+" FROM admin_users WHERE parent_admin_id = $1 ORDER BY role_level DESC",
		parentID,
	)
	if err != nil {
		return nil, fmt.Errorf("admin_repo: get_by_parent: %w", err)
	}
	defer rows.Close()

	var admins []adminModel.AdminUser
	for rows.Next() {
		a, err := scanAdmin(rows)
		if err != nil {
			return nil, err
		}
		admins = append(admins, *a)
	}
	return admins, nil
}

// ─── Internal helpers ───

const adminSelectCols = `id, national_code, full_name, phone, birth_date, gender,
	role_level, role_title, province_codes, parent_admin_id,
	status, failed_attempts, locked_until, last_login_at, last_login_ip::TEXT,
	created_at, updated_at`

func (r *postgresAdminRepo) scanOne(ctx context.Context, whereClause string, args ...interface{}) (*adminModel.AdminUser, error) {
	query := "SELECT " + adminSelectCols + " FROM admin_users WHERE " + whereClause
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin_repo: query: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}
	return scanAdmin(rows)
}

func scanAdmin(rows pgx.Rows) (*adminModel.AdminUser, error) {
	var a adminModel.AdminUser
	err := rows.Scan(
		&a.ID, &a.NationalCode, &a.FullName, &a.Phone, &a.BirthDate, &a.Gender,
		&a.RoleLevel, &a.RoleTitle, &a.ProvinceCodes, &a.ParentAdminID,
		&a.Status, &a.FailedAttempts, &a.LockedUntil, &a.LastLoginAt, &a.LastLoginIP,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("admin_repo: scan: %w", err)
	}
	return &a, nil
}
