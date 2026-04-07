package service

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

const maxAllocationPerCategory = 999999.99

func newPreciseFloat(f float64) *big.Float {
	return new(big.Float).SetPrec(128).SetFloat64(f)
}

// AllocationService computes coupon allocations from a household's members,
// applying base amounts, special-flag multipliers, location segment multipliers,
// and KYC tier factors. All multiplier configuration is loaded from the
// SettingsService — values are NOT hardcoded so admins can adjust the engine
// at runtime via the system_settings table.
type AllocationService struct {
	allocationRepo repository.AllocationRepository
	settings       *SettingsService
	idGen          *idgen.Generator
	logger         *zap.Logger
}

func NewAllocationService(
	allocationRepo repository.AllocationRepository,
	settings *SettingsService,
	idGen *idgen.Generator,
	logger *zap.Logger,
) *AllocationService {
	return &AllocationService{
		allocationRepo: allocationRepo,
		settings:       settings,
		idGen:          idGen,
		logger:         logger,
	}
}

// fallbackBaseAllocations is used only as a defensive fallback if the settings
// service has no data for a given age group. In normal operation every age
// group is present in `system_settings.allocation_base_amounts`.
var fallbackBaseAllocations = map[string]map[model.CouponCategory]string{
	model.AgeGroupAdult18to59: {
		model.CategoryWater: "450", model.CategoryFood: "16.05",
		model.CategoryFuel: "0.96", model.CategoryHygiene: "4",
		model.CategoryMedical: "2.3", model.CategoryEnergy: "3.5",
	},
}

func (s *AllocationService) CalculateAndIssue(ctx context.Context, household *model.Household, members []model.HouseholdMember) error {
	if len(members) == 0 {
		return nil
	}

	categoryTotals := make(map[model.CouponCategory]*big.Float)
	for _, cat := range model.AllCategories() {
		categoryTotals[cat] = newPreciseFloat(0)
	}

	for _, member := range members {
		// Look up base amounts for this member's age group from settings.
		// Fall back to adult amounts if the configured snapshot is missing
		// the age group (defensive — settings should always have all groups).
		for _, cat := range model.AllCategories() {
			amountStr := s.settings.GetBaseAmount(member.AgeGroup, string(cat))
			if amountStr == "" {
				if fallback, ok := fallbackBaseAllocations[model.AgeGroupAdult18to59]; ok {
					amountStr = fallback[cat]
				}
			}
			if amountStr == "" {
				continue
			}

			amount, _ := new(big.Float).SetPrec(128).SetString(amountStr)
			if amount == nil {
				continue
			}

			// Apply the highest applicable special-flag multiplier per category.
			// Choosing max (rather than multiplying flags together) prevents
			// stacking abuse that could blow past the safety cap.
			maxFlagMult := 1.0
			for _, flag := range member.SpecialFlags {
				m := s.settings.GetSpecialFlagMultiplier(flag, string(cat))
				if m > maxFlagMult {
					maxFlagMult = m
				}
			}
			if maxFlagMult > 1.0 {
				amount.Mul(amount, newPreciseFloat(maxFlagMult))
			}
			categoryTotals[cat].Add(categoryTotals[cat], amount)
		}
	}

	maxAmount := newPreciseFloat(maxAllocationPerCategory)
	for cat, total := range categoryTotals {
		if total.Cmp(maxAmount) > 0 {
			categoryTotals[cat].Set(maxAmount)
		}
	}

	// Apply location segment multiplier (uniform across all categories).
	segment := strings.ToLower(strings.TrimSpace(household.LocationSegment))
	if mult := s.settings.GetLocationMultiplier(segment); mult != 1.0 {
		for cat := range categoryTotals {
			categoryTotals[cat].Mul(categoryTotals[cat], newPreciseFloat(mult))
		}
	}

	for cat, total := range categoryTotals {
		if total.Cmp(maxAmount) > 0 {
			categoryTotals[cat].Set(maxAmount)
		}
	}

	// Apply KYC tier factor.
	kycFactor, ok := s.settings.GetKYCTierFactor(household.KYCTier)
	if !ok {
		return fmt.Errorf("allocation_service: invalid KYC tier %d", household.KYCTier)
	}
	for cat := range categoryTotals {
		categoryTotals[cat].Mul(categoryTotals[cat], newPreciseFloat(kycFactor))
	}

	for cat, total := range categoryTotals {
		if total.Cmp(maxAmount) > 0 {
			categoryTotals[cat].Set(maxAmount)
		}
	}

	now := time.Now().UTC()
	cycleStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	cycleEnd := cycleStart.AddDate(0, 1, 0).Add(-time.Second)

	weeklyPcts := s.settings.GetWeeklyReleasePcts()

	var allocations []model.CouponAllocation
	for _, cat := range model.AllCategories() {
		totalStr := categoryTotals[cat].Text('f', 2)
		allocID, err := s.idGen.Generate()
		if err != nil {
			return fmt.Errorf("allocation_service: generate id: %w", err)
		}
		allocations = append(allocations, model.CouponAllocation{
			ID: allocID, HouseholdID: household.ID, Category: cat,
			CycleStart: cycleStart, CycleEnd: cycleEnd,
			TotalAmount: totalStr, UsedAmount: "0.00", RemainingAmount: totalStr,
			WeeklyReleasePcts: weeklyPcts, CurrentWeek: 1,
			Status: model.AllocationStatusActive,
		})
	}

	// Delete stale allocations for this cycle (only if nothing was redeemed yet)
	if err := s.allocationRepo.DeleteByHouseholdCycle(ctx, household.ID, cycleStart, cycleEnd); err != nil {
		s.logger.Warn("failed to delete old allocations", zap.Error(err))
	}

	if err := s.allocationRepo.CreateBatch(ctx, allocations); err != nil {
		return fmt.Errorf("allocation_service: create batch: %w", err)
	}

	s.logger.Info("allocations issued", zap.Int64("household_id", household.ID), zap.Int("members", len(members)))
	return nil
}

func (s *AllocationService) GetBalances(ctx context.Context, householdID int64) (*model.AllBalancesResponse, error) {
	allocations, err := s.allocationRepo.GetCurrentCycleAllocations(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("allocation_service: get balances: %w", err)
	}
	var balances []model.CategoryBalanceResponse
	for _, a := range allocations {
		balances = append(balances, model.CategoryBalanceResponse{
			Category: a.Category, TotalAmount: a.TotalAmount, UsedAmount: a.UsedAmount,
			RemainingAmount: a.RemainingAmount, AvailableNow: GetAvailableAmount(&a),
			CurrentWeek: a.CurrentWeek, CycleStart: a.CycleStart, CycleEnd: a.CycleEnd, Status: a.Status,
		})
	}
	return &model.AllBalancesResponse{HouseholdID: householdID, Balances: balances}, nil
}

func (s *AllocationService) GetCategoryBalance(ctx context.Context, householdID int64, category model.CouponCategory) (*model.CategoryBalanceResponse, error) {
	alloc, err := s.allocationRepo.GetByHouseholdAndCategory(ctx, householdID, category)
	if err != nil {
		return nil, err
	}
	if alloc == nil {
		return nil, fmt.Errorf("no allocation found for this category")
	}
	return &model.CategoryBalanceResponse{
		Category: alloc.Category, TotalAmount: alloc.TotalAmount, UsedAmount: alloc.UsedAmount,
		RemainingAmount: alloc.RemainingAmount, AvailableNow: GetAvailableAmount(alloc),
		CurrentWeek: alloc.CurrentWeek, CycleStart: alloc.CycleStart, CycleEnd: alloc.CycleEnd, Status: alloc.Status,
	}, nil
}

func GetAvailableAmount(alloc *model.CouponAllocation) string {
	now := time.Now().UTC()
	if now.Before(alloc.CycleStart) || now.After(alloc.CycleEnd) {
		return "0.00"
	}
	daysSinceStart := int(now.Sub(alloc.CycleStart).Hours() / 24)
	if daysSinceStart < 0 {
		return "0.00"
	}
	currentWeek := (daysSinceStart / 7) + 1
	if currentWeek > 4 {
		currentWeek = 4
	}

	cumulativePct := 0
	for i := 0; i < currentWeek; i++ {
		cumulativePct += alloc.WeeklyReleasePcts[i]
	}

	totalAmount, _ := new(big.Float).SetPrec(128).SetString(alloc.TotalAmount)
	if totalAmount == nil {
		return "0.00"
	}

	releasedAmount := new(big.Float).SetPrec(128).Mul(totalAmount,
		new(big.Float).SetPrec(128).Quo(
			new(big.Float).SetPrec(128).SetInt64(int64(cumulativePct)),
			new(big.Float).SetPrec(128).SetInt64(100),
		),
	)

	usedAmount, _ := new(big.Float).SetPrec(128).SetString(alloc.UsedAmount)
	if usedAmount == nil {
		usedAmount = newPreciseFloat(0)
	}

	available := new(big.Float).SetPrec(128).Sub(releasedAmount, usedAmount)
	if available.Sign() < 0 {
		return "0.00"
	}

	remaining, _ := new(big.Float).SetPrec(128).SetString(alloc.RemainingAmount)
	if remaining != nil && available.Cmp(remaining) > 0 {
		available = remaining
	}

	return available.Text('f', 2)
}
