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

// EntityService handles admin operations on coupon system entities.
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "verify_kyc", EntityType: "member", EntityID: &memberID,
		NewValue: map[string]bool{"kyc_verified": verified},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Allocations ───

func (s *EntityService) ListAllocations(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponAllocation, int, error) {
	return s.entityRepo.ListAllocations(ctx, status, category, offset, limit)
}

func (s *EntityService) AdjustAllocation(ctx context.Context, id int64, newAmount string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.AdjustAllocation(ctx, id, newAmount, session.AdminID); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "adjust", EntityType: "allocation", EntityID: &id,
		NewValue: map[string]string{"new_amount": newAmount},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Catalog Items ───

func (s *EntityService) ListCatalogItems(ctx context.Context, category string, offset, limit int) ([]map[string]interface{}, int, error) {
	return s.entityRepo.ListCatalogItems(ctx, category, offset, limit)
}

// ─── Power Banks ───

func (s *EntityService) ListPowerBanks(ctx context.Context, status string, offset, limit int) ([]couponModel.PowerBankSwap, int, error) {
	return s.entityRepo.ListPowerBanks(ctx, status, offset, limit)
}

// ─── Households ───

func (s *EntityService) ListHouseholds(ctx context.Context, search, status string, offset, limit int) ([]couponModel.Household, int, error) {
	return s.entityRepo.ListHouseholds(ctx, search, status, offset, limit)
}

func (s *EntityService) GetHouseholdDetail(ctx context.Context, id int64) (*couponModel.Household, []couponModel.HouseholdMember, error) {
	h, m, err := s.entityRepo.GetHouseholdDetail(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if h == nil {
		return nil, nil, appErrors.ErrNotFound
	}
	return h, m, nil
}

func (s *EntityService) SuspendHousehold(ctx context.Context, id int64, reason string, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateHouseholdStatus(ctx, id, "suspended", reason); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reactivate", EntityType: "household", EntityID: &id,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Redemptions ───

func (s *EntityService) ListRedemptions(ctx context.Context, status, category string, offset, limit int) ([]couponModel.CouponRedemption, int, error) {
	return s.entityRepo.ListRedemptions(ctx, status, category, offset, limit)
}

func (s *EntityService) ResolveDispute(ctx context.Context, redemptionID int64, accepted bool, resolution string, session *adminModel.AdminSession) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := s.entityRepo.ResolveDispute(ctx, tx, redemptionID, accepted, resolution, session.AdminID); err != nil {
		return err
	}

	// If accepted (reversed), credit the allocation back
	if accepted {
		var allocID int64
		var amount string
		err := tx.QueryRow(ctx, "SELECT allocation_id, amount FROM coupon_redemptions WHERE id = $1", redemptionID).Scan(&allocID, &amount)
		if err != nil {
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: action, EntityType: "redemption", EntityID: &redemptionID,
		NewValue: map[string]string{"resolution": resolution, "accepted": fmt.Sprintf("%v", accepted)},
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

// ─── Distribution Centers ───

func (s *EntityService) ListCenters(ctx context.Context, status string, offset, limit int) ([]couponModel.DistributionCenter, int, error) {
	return s.entityRepo.ListCenters(ctx, status, offset, limit)
}

// ─── Support Tickets ───

func (s *EntityService) ListTickets(ctx context.Context, status, priority string, offset, limit int) ([]couponModel.SupportTicket, int, error) {
	return s.entityRepo.ListTickets(ctx, status, priority, offset, limit)
}

func (s *EntityService) ResolveTicket(ctx context.Context, ticketID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateTicketStatus(ctx, ticketID, "resolved", session.AdminID); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "approve", EntityType: "volunteer", EntityID: &volunteerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) RejectVolunteer(ctx context.Context, volunteerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateVolunteerStatus(ctx, volunteerID, "rejected", session.AdminID); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
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
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "approve", EntityType: "provider", EntityID: &providerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}

func (s *EntityService) RejectProvider(ctx context.Context, providerID int64, session *adminModel.AdminSession) error {
	if err := s.entityRepo.UpdateProviderStatus(ctx, providerID, "rejected", session.AdminID); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &adminModel.AuditLog{
		AdminID: session.AdminID, Action: "reject", EntityType: "provider", EntityID: &providerID,
		IPAddress: session.IPAddress, UserAgent: session.UserAgent, SessionID: session.ID,
	})
	return nil
}
