package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/viwo-app/mini-coupon/internal/coupon/model"
)

type DistributionRepository interface {
	GetByID(ctx context.Context, id int64) (*model.DistributionCenter, error)
	GetNearby(ctx context.Context, lat, lng, radiusKm float64, category *string) ([]model.DistributionCenter, error)
}

type postgresDistributionRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresDistributionRepo(pool *pgxpool.Pool) DistributionRepository {
	return &postgresDistributionRepo{pool: pool}
}

func (r *postgresDistributionRepo) GetByID(ctx context.Context, id int64) (*model.DistributionCenter, error) {
	query := `
		SELECT id, name, type, address, lat, lng, categories,
		       operating_hours, queue_minutes, province_code, status, created_at, updated_at
		FROM distribution_centers WHERE id = $1`
	var dc model.DistributionCenter
	var categories []string
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&dc.ID, &dc.Name, &dc.Type, &dc.Address, &dc.Lat, &dc.Lng, &categories,
		&dc.OperatingHours, &dc.QueueMinutes, &dc.ProvinceCode, &dc.Status,
		&dc.CreatedAt, &dc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("distribution_repo: get by id: %w", err)
	}
	dc.Categories = make([]model.CouponCategory, len(categories))
	for i, c := range categories {
		dc.Categories[i] = model.CouponCategory(c)
	}
	return &dc, nil
}

func (r *postgresDistributionRepo) GetNearby(ctx context.Context, lat, lng, radiusKm float64, category *string) ([]model.DistributionCenter, error) {
	args := []interface{}{lat, lng}
	query := `
		SELECT * FROM (
			SELECT id, name, type, address, lat, lng, categories,
			       operating_hours, queue_minutes, province_code, status, created_at, updated_at,
			       (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) AS distance_km
			FROM distribution_centers WHERE status = 'open'`

	if category != nil && *category != "" {
		query += ` AND $3 = ANY(categories)`
		args = append(args, *category)
		query += fmt.Sprintf(`) sub WHERE distance_km <= $%d ORDER BY distance_km ASC LIMIT 50`, len(args)+1)
		args = append(args, radiusKm)
	} else {
		query += fmt.Sprintf(`) sub WHERE distance_km <= $%d ORDER BY distance_km ASC LIMIT 50`, len(args)+1)
		args = append(args, radiusKm)
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("distribution_repo: get nearby: %w", err)
	}
	defer rows.Close()

	centers := make([]model.DistributionCenter, 0)
	for rows.Next() {
		var dc model.DistributionCenter
		var categories []string
		var distanceKm float64
		if err := rows.Scan(
			&dc.ID, &dc.Name, &dc.Type, &dc.Address, &dc.Lat, &dc.Lng, &categories,
			&dc.OperatingHours, &dc.QueueMinutes, &dc.ProvinceCode, &dc.Status,
			&dc.CreatedAt, &dc.UpdatedAt, &distanceKm,
		); err != nil {
			return nil, fmt.Errorf("distribution_repo: scan: %w", err)
		}
		dc.Categories = make([]model.CouponCategory, len(categories))
		for i, c := range categories {
			dc.Categories[i] = model.CouponCategory(c)
		}
		centers = append(centers, dc)
	}
	return centers, rows.Err()
}
