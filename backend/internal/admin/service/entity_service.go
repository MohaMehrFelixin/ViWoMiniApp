package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	adminModel "github.com/viwo-app/mini-coupon/internal/admin/model"
	"github.com/viwo-app/mini-coupon/internal/admin/repository"
	couponModel "github.com/viwo-app/mini-coupon/internal/coupon/model"
	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
)

// EntityService handles admin operations on coupon system entities. All
// mutating methods write an audit log entry — failures to write the audit
// log are surfaced to the logger (FIX B4) so they don't get silently dropped.
type EntityService struct {
	entityRepo *repository.EntityRepository
	auditRepo  repository.AuditRepository
	pool       *pgxpool.Pool
	logger     *zap.Logger
}

func NewEntityService(
	entityRepo *repository.EntityRepository,
	auditRepo repository.AuditRepository,
	pool *pgxpool.Pool,
	logger *zap.Logger,
) *EntityService {
	return &EntityService{entityRepo: entityRepo, auditRepo: auditRepo, pool: pool, logger: logger}
}

// audit writes an entry, logging failures instead of swallowing them. The
// caller's primary operation has already committed when this is invoked, so
// audit failure does NOT roll back the action — but it MUST be visible.
//
// Trade-off: failing the request would be safer for compliance, but pragmatic
// for now: log loudly + alerting catches it.
func (s *EntityService) audit(ctx context.Context, entry *adminModel.AuditLog) {
	if err := s.auditRepo.Log(ctx, entry); err != nil {
		s.logger.Error("audit_log_failed",
			zap.String("action", entry.Action),
			zap.String("entity_type", entry.EntityType),
			zap.Int64p("entity_id", entry.EntityID),
			zap.Int64("admin_id", entry.AdminID),
			zap.Error(err),
		)
	}
}

// ─── Dashboard ───

func (s *EntityService) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	return s.entityRepo.GetDashboardStats(ctx)
}

// ─── Members ───

func (s *EntityService) ListMembers(ctx context.Context, search string, kycVerified *bool, offset, limit int) ([]couponModel.HouseholdMember, int, error) {
	return s.entityRepo.ListMembers(ctx, search, kycVerified, offset, limit)
}

func (s *EntityService) VerifyMemberKYC(ctx context.Context, memberID int64, verified bool, session *adminModel.AdminSession) error {
	if err := s.entityRepo.VerifyMemberKYC(ctx, memberID, verified); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "verify_kyc", EntityType: "member", EntityID: &memberID,
		NewValue: map[string]bool{"kyc_verified": verified},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// BulkVerifyMembers marks multiple members verified atomically.
func (s *EntityService) BulkVerifyMembers(ctx context.Context, ids []int64, session *adminModel.AdminSession) (int64, error) {
	count, err := s.entityRepo.BulkVerifyMembers(ctx, ids)
	if err != nil {
		return 0, err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "bulk_verify", EntityType: "member",
		NewValue:  map[string]interface{}{"member_ids": ids, "verified_count": count},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return count, nil
}

// SoftDeleteMember marks a member deleted and triggers re-allocation context.
// The downstream allocation refresh is left to a follow-up task to keep this
// operation atomic at the DB level.
func (s *EntityService) SoftDeleteMember(ctx context.Context, memberID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.SoftDeleteMember(ctx, memberID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "delete", EntityType: "member", EntityID: &memberID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Allocations ───

func (s *EntityService) ListAllocations(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponAllocation, int, error) {
	return s.entityRepo.ListAllocations(ctx, status, category, offset, limit)
}

// AdjustAllocation now requires a reason (FIX B3 — spec calls for "audit reason").
// Validation errors from the repo are mapped to BadRequest so the frontend
// shows a meaningful message instead of a generic 500.
func (s *EntityService) AdjustAllocation(ctx context.Context, id int64, newAmount, reason string, session *adminModel.AdminSession) error {
	if reason == "" {
		return appErrors.ErrBadRequest.WithMessage("reason is required for allocation adjustments")
	}
	if err := s.entityRepo.AdjustAllocation(ctx, id, newAmount, session.AdminID); err != nil {
		// Repo validation errors are user input errors, not server errors.
		return appErrors.ErrBadRequest.WithMessage(err.Error())
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "adjust", EntityType: "allocation", EntityID: &id,
		NewValue:  map[string]string{"new_amount": newAmount, "reason": reason},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// PauseAllocation flags an allocation as paused.
func (s *EntityService) PauseAllocation(ctx context.Context, id int64, reason string, session *adminModel.AdminSession) error {
	if reason == "" {
		return appErrors.ErrBadRequest.WithMessage("reason required")
	}
	if err := s.entityRepo.PauseAllocation(ctx, id, reason, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "pause", EntityType: "allocation", EntityID: &id,
		NewValue:  map[string]string{"reason": reason},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) ResumeAllocation(ctx context.Context, id int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.ResumeAllocation(ctx, id, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "resume", EntityType: "allocation", EntityID: &id,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) ExpireAllocation(ctx context.Context, id int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.ExpireAllocation(ctx, id, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "expire", EntityType: "allocation", EntityID: &id,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Catalog Items ───

func (s *EntityService) ListCatalogItems(ctx context.Context, category string, offset, limit int) ([]map[string]interface{}, int, error) {
	return s.entityRepo.ListCatalogItems(ctx, category, offset, limit)
}

// CreateCatalogItem (FIX B1) — was previously wired to ListCatalogItems.
func (s *EntityService) CreateCatalogItem(ctx context.Context, item map[string]interface{}, session *adminModel.AdminSession) (int64, error) {
	id, err := s.entityRepo.CreateCatalogItem(ctx, item, session.AdminID)
	if err != nil {
		return 0, err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "create", EntityType: "catalog_item", EntityID: &id,
		NewValue:  item,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return id, nil
}

// ─── Power Banks ───

func (s *EntityService) ListPowerBanks(ctx context.Context, status string, offset, limit int) ([]couponModel.PowerBankSwap, int, error) {
	return s.entityRepo.ListPowerBanks(ctx, status, offset, limit)
}

// AdminForceSwapStatus is an admin override that ignores the normal state machine.
// Spec §3.2 calls this "Override Status / Force-cancel".
func (s *EntityService) AdminForceSwapStatus(ctx context.Context, id int64, status, notes string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.AdminForceSwapStatus(ctx, id, status, notes, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "force_status", EntityType: "powerbank", EntityID: &id,
		NewValue:  map[string]string{"status": status, "notes": notes},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Households ───

// ListHouseholds applies the admin's province scope automatically. The
// session's province codes are read from context by the handler and passed in.
func (s *EntityService) ListHouseholds(ctx context.Context, search, status string, provinceScope []string, offset, limit int) ([]couponModel.Household, int, error) {
	return s.entityRepo.ListHouseholds(ctx, search, status, provinceScope, offset, limit)
}

func (s *EntityService) GetHouseholdDetail(ctx context.Context, id int64, provinceScope []string) (*couponModel.Household, []couponModel.HouseholdMember, error) {
	h, m, err := s.entityRepo.GetHouseholdDetail(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if h == nil {
		return nil, nil, appErrors.ErrNotFound
	}
	// Province scope check at the service layer (defense-in-depth alongside
	// the handler-level RequireScope middleware).
	if len(provinceScope) > 0 {
		allowed := false
		for _, p := range provinceScope {
			if p == h.ProvinceCode {
				allowed = true
				break
			}
		}
		if !allowed {
			return nil, nil, appErrors.ErrForbidden.WithMessage("Household is outside your regional scope")
		}
	}
	return h, m, nil
}

func (s *EntityService) SuspendHousehold(ctx context.Context, id int64, reason string, session *adminModel.AdminSession) error {
	if reason == "" {
		return appErrors.ErrBadRequest.WithMessage("reason required")
	}
	if err := s.entityRepo.UpdateHouseholdStatus(ctx, id, "suspended", reason); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "suspend", EntityType: "household", EntityID: &id,
		NewValue: map[string]string{"status": "suspended", "reason": reason},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) ReactivateHousehold(ctx context.Context, id int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateHouseholdStatus(ctx, id, "active", ""); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reactivate", EntityType: "household", EntityID: &id,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// UpdateHouseholdNotes lets admins attach notes for context.
func (s *EntityService) UpdateHouseholdNotes(ctx context.Context, id int64, notes string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateHouseholdNotes(ctx, id, notes, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update_notes", EntityType: "household", EntityID: &id,
		NewValue:  map[string]string{"notes": notes},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// UpdateHouseholdKYCStatus lets KYC officers force re-verification.
func (s *EntityService) UpdateHouseholdKYCStatus(ctx context.Context, id int64, status string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateHouseholdKYCStatus(ctx, id, status, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update_kyc_status", EntityType: "household", EntityID: &id,
		NewValue:  map[string]string{"kyc_status": status},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Redemptions ───

func (s *EntityService) ListRedemptions(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponRedemption, int, error) {
	return s.entityRepo.ListRedemptions(ctx, status, category, offset, limit)
}

// ResolveDispute either reverses (credits allocation) or rejects the dispute.
// Performed in a serializable transaction so concurrent admin actions can't
// double-credit the allocation.
func (s *EntityService) ResolveDispute(ctx context.Context, redemptionID int64, accepted bool, resolution string, session *adminModel.AdminSession) error {
	if resolution == "" {
		return appErrors.ErrBadRequest.WithMessage("resolution required")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := s.entityRepo.ResolveDispute(ctx, tx, redemptionID, accepted, resolution, session.AdminID); err != nil {
		return err
	}

	if accepted {
		var allocID int64
		var amount string
		if err := tx.QueryRow(ctx, "SELECT allocation_id, amount FROM coupon_redemptions WHERE id = $1", redemptionID).Scan(&allocID, &amount); err != nil {
			return fmt.Errorf("get redemption for reversal: %w", err)
		}
		if err := s.entityRepo.ReverseAllocation(ctx, tx, allocID, amount); err != nil {
			return fmt.Errorf("reverse allocation: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	action := "reject_dispute"
	if accepted {
		action = "accept_dispute"
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: action, EntityType: "redemption", EntityID: &redemptionID,
		NewValue:  map[string]string{"resolution": resolution, "accepted": fmt.Sprintf("%v", accepted)},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ReverseRedemption is an admin-initiated reversal NOT tied to a dispute.
// Same allocation credit-back logic as ResolveDispute(accepted=true) but with
// a different audit action so they're distinguishable.
func (s *EntityService) ReverseRedemption(ctx context.Context, redemptionID int64, reason string, session *adminModel.AdminSession) error {
	if reason == "" {
		return appErrors.ErrBadRequest.WithMessage("reason required")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Force the status without the disputed pre-condition by writing directly.
	tag, err := tx.Exec(ctx, `
		UPDATE coupon_redemptions
		SET status = 'reversed', dispute_resolution = $2, dispute_resolved_by = $3, dispute_resolved_at = NOW()
		WHERE id = $1 AND status IN ('completed', 'disputed')`,
		redemptionID, reason, session.AdminID,
	)
	if err != nil {
		return fmt.Errorf("reverse: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound.WithMessage("redemption not found or already reversed")
	}

	var allocID int64
	var amount string
	if err := tx.QueryRow(ctx, "SELECT allocation_id, amount FROM coupon_redemptions WHERE id = $1", redemptionID).Scan(&allocID, &amount); err != nil {
		return fmt.Errorf("get for reversal: %w", err)
	}
	if err := s.entityRepo.ReverseAllocation(ctx, tx, allocID, amount); err != nil {
		return fmt.Errorf("credit allocation: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reverse", EntityType: "redemption", EntityID: &redemptionID,
		NewValue:  map[string]string{"reason": reason},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Distribution Centers ───

func (s *EntityService) ListCenters(ctx context.Context, status string, provinceScope []string, offset, limit int) ([]couponModel.DistributionCenter, int, error) {
	return s.entityRepo.ListCenters(ctx, status, provinceScope, offset, limit)
}

func (s *EntityService) GetCenter(ctx context.Context, id int64) (*couponModel.DistributionCenter, error) {
	c, err := s.entityRepo.GetCenter(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, appErrors.ErrNotFound
	}
	return c, nil
}

// CreateCenter wraps the repo method so the admin handler doesn't talk to
// the repo directly. ID generation is done by the handler.
func (s *EntityService) CreateCenter(ctx context.Context, c *couponModel.DistributionCenter, session *adminModel.AdminSession) error {
	if err := s.entityRepo.CreateCenter(ctx, c); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "create", EntityType: "center", EntityID: &c.ID,
		NewValue:  c,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) UpdateCenter(ctx context.Context, id int64, fields map[string]interface{}, session *adminModel.AdminSession) error {
	// Always stamp the editor for traceability.
	fields["last_modified_by"] = session.AdminID
	if err := s.entityRepo.UpdateCenter(ctx, id, fields); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update", EntityType: "center", EntityID: &id,
		NewValue:  fields,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) UpdateCenterStock(ctx context.Context, id int64, stockStatus map[string]string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateCenterStock(ctx, id, stockStatus, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "update_stock", EntityType: "center", EntityID: &id,
		NewValue:  stockStatus,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) DeactivateCenter(ctx context.Context, id int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.DeactivateCenter(ctx, id, session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "deactivate", EntityType: "center", EntityID: &id,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Support Tickets ───

func (s *EntityService) ListTickets(ctx context.Context, status, priority string, offset, limit int) ([]couponModel.SupportTicket, int, error) {
	return s.entityRepo.ListTickets(ctx, status, priority, offset, limit)
}

func (s *EntityService) ResolveTicket(ctx context.Context, ticketID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateTicketStatus(ctx, ticketID, "resolved", session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "resolve", EntityType: "ticket", EntityID: &ticketID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Volunteers ───

func (s *EntityService) ListVolunteers(ctx context.Context, status string, offset, limit int) ([]map[string]interface{}, int, error) {
	return s.entityRepo.ListVolunteers(ctx, status, offset, limit)
}

func (s *EntityService) ApproveVolunteer(ctx context.Context, volunteerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateVolunteerStatus(ctx, volunteerID, "approved", session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "approve", EntityType: "volunteer", EntityID: &volunteerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) RejectVolunteer(ctx context.Context, volunteerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateVolunteerStatus(ctx, volunteerID, "rejected", session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reject", EntityType: "volunteer", EntityID: &volunteerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Providers ───

func (s *EntityService) ListProviders(ctx context.Context, status string, offset, limit int) ([]interface{}, int, error) {
	return s.entityRepo.ListProviders(ctx, status, offset, limit)
}

func (s *EntityService) ApproveProvider(ctx context.Context, providerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateProviderStatus(ctx, providerID, "approved", session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "approve", EntityType: "provider", EntityID: &providerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) RejectProvider(ctx context.Context, providerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateProviderStatus(ctx, providerID, "rejected", session.AdminID); err != nil {
		return err
	}
	s.audit(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reject", EntityType: "provider", EntityID: &providerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}
