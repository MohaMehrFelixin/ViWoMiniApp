package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"

	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

type PowerBankService struct {
	swapRepo      repository.PowerBankRepository
	householdRepo repository.HouseholdRepository
	idGen         *idgen.Generator
	logger        *zap.Logger
}

func NewPowerBankService(
	swapRepo repository.PowerBankRepository,
	householdRepo repository.HouseholdRepository,
	idGen *idgen.Generator,
	logger *zap.Logger,
) *PowerBankService {
	return &PowerBankService{swapRepo: swapRepo, householdRepo: householdRepo, idGen: idGen, logger: logger}
}

func generateSwapCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return "PB-" + string(b[:4]) + "-" + string(b[4:])
}

func (s *PowerBankService) RequestSwap(ctx context.Context, householdID int64, tgUserID int64, centerID int64) (*model.PowerBankSwap, error) {
	// Verify the requester is head of household
	members, err := s.householdRepo.GetMembers(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("powerbank_service: get members: %w", err)
	}

	var headMember *model.HouseholdMember
	for i := range members {
		if strings.EqualFold(members[i].Relationship, "head") {
			headMember = &members[i]
			break
		}
	}
	if headMember == nil {
		return nil, appErrors.ErrForbidden.WithMessage("Only the head of household can request a power bank swap")
	}

	// Check no active swap already exists
	active, err := s.swapRepo.GetActiveByHousehold(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("powerbank_service: check active: %w", err)
	}
	if active != nil {
		return nil, appErrors.ErrConflict.WithMessage("You already have an active power bank swap")
	}

	swapID, err := s.idGen.Generate()
	if err != nil {
		return nil, fmt.Errorf("powerbank_service: generate id: %w", err)
	}

	swap := &model.PowerBankSwap{
		ID:          swapID,
		HouseholdID: householdID,
		MemberID:    headMember.ID,
		Status:      model.SwapStatusPending,
		SwapCode:    generateSwapCode(),
		CenterID:    &centerID,
	}

	if err := s.swapRepo.Create(ctx, swap); err != nil {
		return nil, fmt.Errorf("powerbank_service: create: %w", err)
	}

	s.logger.Info("power bank swap requested",
		zap.Int64("household_id", householdID),
		zap.String("swap_code", swap.SwapCode),
	)
	return swap, nil
}

func (s *PowerBankService) GetSwaps(ctx context.Context, householdID int64) (*model.PowerBankSwapsResponse, error) {
	swaps, err := s.swapRepo.GetByHousehold(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("powerbank_service: list: %w", err)
	}

	active, err := s.swapRepo.GetActiveByHousehold(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("powerbank_service: get active: %w", err)
	}

	return &model.PowerBankSwapsResponse{Swaps: swaps, ActiveSwap: active}, nil
}

func (s *PowerBankService) PickUp(ctx context.Context, swapID int64, householdID int64) error {
	swap, err := s.swapRepo.GetByID(ctx, swapID)
	if err != nil || swap == nil {
		return appErrors.ErrNotFound.WithMessage("Swap not found")
	}
	if swap.HouseholdID != householdID {
		return appErrors.ErrForbidden.WithMessage("Not your swap")
	}
	return s.swapRepo.PickUp(ctx, swapID)
}

func (s *PowerBankService) ReturnBank(ctx context.Context, swapID int64, householdID int64) error {
	swap, err := s.swapRepo.GetByID(ctx, swapID)
	if err != nil || swap == nil {
		return appErrors.ErrNotFound.WithMessage("Swap not found")
	}
	if swap.HouseholdID != householdID {
		return appErrors.ErrForbidden.WithMessage("Not your swap")
	}
	return s.swapRepo.Return(ctx, swapID)
}

func (s *PowerBankService) CancelSwap(ctx context.Context, swapID int64, householdID int64) error {
	swap, err := s.swapRepo.GetByID(ctx, swapID)
	if err != nil || swap == nil {
		return appErrors.ErrNotFound.WithMessage("Swap not found")
	}
	if swap.HouseholdID != householdID {
		return appErrors.ErrForbidden.WithMessage("Not your swap")
	}
	if swap.Status == model.SwapStatusPickedUp {
		return appErrors.ErrBadRequest.WithMessage("Cannot cancel after pickup — return the power bank instead")
	}
	return s.swapRepo.UpdateStatus(ctx, swapID, model.SwapStatusCancelled)
}
