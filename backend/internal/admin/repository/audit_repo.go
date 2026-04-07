package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

// AuditRepository persists audit trail entries.
type AuditRepository interface {
	Log(ctx context.Context, entry *adminModel.AuditLog) error
	GetByEntity(ctx context.Context, entityType string, entityID int64, limit int) ([]adminModel.AuditLog, error)
	GetByAdmin(ctx context.Context, adminID int64, offset, limit int) ([]adminModel.AuditLog, int, error)
	GetPaginated(ctx context.Context, offset, limit int) ([]adminModel.AuditLog, int, error)
}

type postgresAuditRepo struct {
	pool  *pgxpool.Pool
	idGen *idgen.Generator
}

// NewPostgresAuditRepo creates a new PostgreSQL-backed audit repository.
func NewPostgresAuditRepo(pool *pgxpool.Pool, idGen *idgen.Generator) AuditRepository {
	return &postgresAuditRepo{pool: pool, idGen: idGen}
}

func (r *postgresAuditRepo) Log(ctx context.Context, entry *adminModel.AuditLog) error {
	id, _ := r.idGen.Generate()
	entry.ID = id

	oldJSON, _ := json.Marshal(entry.OldValue)
	newJSON, _ := json.Marshal(entry.NewValue)

	query := `
		INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id,
			old_value, new_value, ip_address, user_agent, session_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, $10, NOW())`
	_, err := r.pool.Exec(ctx, query,
		entry.ID, entry.AdminID, entry.Action, entry.EntityType, entry.EntityID,
		oldJSON, newJSON, entry.IPAddress, entry.UserAgent, entry.SessionID,
	)
	if err != nil {
		return fmt.Errorf("audit_repo: log: %w", err)
	}
	return nil
}

func (r *postgresAuditRepo) GetByEntity(ctx context.Context, entityType string, entityID int64, limit int) ([]adminModel.AuditLog, error) {
	rows, err := r.pool.Query(ctx,
		"SELECT id, admin_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, session_id, created_at FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT $3",
		entityType, entityID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("audit_repo: get_by_entity: %w", err)
	}
	defer rows.Close()

	var logs []adminModel.AuditLog
	for rows.Next() {
		var l adminModel.AuditLog
		var oldVal, newVal []byte
		var ip *string
		if err := rows.Scan(&l.ID, &l.AdminID, &l.Action, &l.EntityType, &l.EntityID, &oldVal, &newVal, &ip, &l.UserAgent, &l.SessionID, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("audit_repo: scan: %w", err)
		}
		if oldVal != nil {
			_ = json.Unmarshal(oldVal, &l.OldValue)
		}
		if newVal != nil {
			_ = json.Unmarshal(newVal, &l.NewValue)
		}
		if ip != nil {
			l.IPAddress = *ip
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (r *postgresAuditRepo) GetByAdmin(ctx context.Context, adminID int64, offset, limit int) ([]adminModel.AuditLog, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM audit_logs WHERE admin_id = $1", adminID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		"SELECT id, admin_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, session_id, created_at FROM audit_logs WHERE admin_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
		adminID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []adminModel.AuditLog
	for rows.Next() {
		var l adminModel.AuditLog
		var oldVal, newVal []byte
		var ip *string
		if err := rows.Scan(&l.ID, &l.AdminID, &l.Action, &l.EntityType, &l.EntityID, &oldVal, &newVal, &ip, &l.UserAgent, &l.SessionID, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		if oldVal != nil {
			_ = json.Unmarshal(oldVal, &l.OldValue)
		}
		if newVal != nil {
			_ = json.Unmarshal(newVal, &l.NewValue)
		}
		if ip != nil {
			l.IPAddress = *ip
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

func (r *postgresAuditRepo) GetPaginated(ctx context.Context, offset, limit int) ([]adminModel.AuditLog, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM audit_logs").Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		"SELECT id, admin_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, session_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []adminModel.AuditLog
	for rows.Next() {
		var l adminModel.AuditLog
		var oldVal, newVal []byte
		var ip *string
		if err := rows.Scan(&l.ID, &l.AdminID, &l.Action, &l.EntityType, &l.EntityID, &oldVal, &newVal, &ip, &l.UserAgent, &l.SessionID, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		if oldVal != nil {
			_ = json.Unmarshal(oldVal, &l.OldValue)
		}
		if newVal != nil {
			_ = json.Unmarshal(newVal, &l.NewValue)
		}
		if ip != nil {
			l.IPAddress = *ip
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}
