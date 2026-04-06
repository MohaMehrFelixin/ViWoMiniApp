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

type AllocationService struct {
	allocationRepo repository.AllocationRepository
	idGen          *idgen.Generator
	logger         *zap.Logger
}

func NewAllocationService(allocationRepo repository.AllocationRepository, idGen *idgen.Generator, logger *zap.Logger) *AllocationService {
	return &AllocationService{allocationRepo: allocationRepo, idGen: idGen, logger: logger}
}

type ageGroupAllocation struct {
	Water, Food, Fuel, Hygiene, Medical, Energy string
}

var baseAllocations = map[string]ageGroupAllocation{
	model.AgeGroupInfant0to6m:  {Water: "270", Food: "0", Fuel: "0.96", Hygiene: "10", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupInfant6to23m: {Water: "300", Food: "4", Fuel: "0.96", Hygiene: "10", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupChild2to4:    {Water: "330", Food: "8", Fuel: "0.96", Hygiene: "3", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupChild5to11:   {Water: "360", Food: "11", Fuel: "0.96", Hygiene: "3", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupTeen12to17:   {Water: "450", Food: "14", Fuel: "0.96", Hygiene: "4", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupAdult18to59:  {Water: "450", Food: "16.05", Fuel: "0.96", Hygiene: "4", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupSenior60to64: {Water: "450", Food: "16.05", Fuel: "0.96", Hygiene: "4", Medical: "2.3", Energy: "3.5"},
	model.AgeGroupElderly65p:   {Water: "450", Food: "14", Fuel: "0.96", Hygiene: "4", Medical: "2.3", Energy: "3.5"},
}

var specialFlagMultipliers = map[string]map[model.CouponCategory]float64{
	"pregnant":  {model.CategoryFood: 1.25, model.CategoryMedical: 1.50, model.CategoryWater: 1.10},
	"chronic":   {model.CategoryMedical: 14.00, model.CategoryFood: 1.10},
	"sanitary":  {model.CategoryHygiene: 6.00},
	"disability": {model.CategoryMedical: 1.50, model.CategoryHygiene: 1.30},
	"newborn":   {model.CategoryFood: 1.30, model.CategoryHygiene: 1.50, model.CategoryMedical: 1.20},
}

var locationSegmentMultipliers = map[string]map[model.CouponCategory]float64{
	model.LocationSegmentTehran: {model.CategoryWater: 0.80, model.CategoryFood: 0.80, model.CategoryFuel: 0.80, model.CategoryHygiene: 0.80, model.CategoryMedical: 0.80, model.CategoryEnergy: 0.80},
	model.LocationSegmentUrban:  {model.CategoryWater: 1.00, model.CategoryFood: 1.00, model.CategoryFuel: 1.00, model.CategoryHygiene: 1.00, model.CategoryMedical: 1.00, model.CategoryEnergy: 1.00},
	model.LocationSegmentRural:  {model.CategoryWater: 1.20, model.CategoryFood: 1.20, model.CategoryFuel: 1.20, model.CategoryHygiene: 1.20, model.CategoryMedical: 1.20, model.CategoryEnergy: 1.20},
}

var kycTierFactors = map[int]float64{
	model.KYCTierDigital:     1.00,
	model.KYCTierSemiOffline: 0.85,
	model.KYCTierFullOffline: 0.70,
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
		alloc, ok := baseAllocations[member.AgeGroup]
		if !ok {
			alloc = baseAllocations[model.AgeGroupAdult18to59]
		}

		memberAmounts := map[model.CouponCategory]string{
			model.CategoryWater: alloc.Water, model.CategoryFood: alloc.Food,
			model.CategoryFuel: alloc.Fuel, model.CategoryHygiene: alloc.Hygiene,
			model.CategoryMedical: alloc.Medical, model.CategoryEnergy: alloc.Energy,
		}

		for cat, amountStr := range memberAmounts {
			amount, _ := new(big.Float).SetPrec(128).SetString(amountStr)
			if amount == nil {
				continue
			}
			maxFlagMult := 1.0
			for _, flag := range member.SpecialFlags {
				if multipliers, ok := specialFlagMultipliers[flag]; ok {
					if mult, ok := multipliers[cat]; ok && mult > maxFlagMult {
						maxFlagMult = mult
					}
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

	segment := strings.ToLower(strings.TrimSpace(household.LocationSegment))
	if segMultipliers, ok := locationSegmentMultipliers[segment]; ok {
		for cat, mult := range segMultipliers {
			categoryTotals[cat].Mul(categoryTotals[cat], newPreciseFloat(mult))
		}
	}

	for cat, total := range categoryTotals {
		if total.Cmp(maxAmount) > 0 {
			categoryTotals[cat].Set(maxAmount)
		}
	}

	kycFactor, ok := kycTierFactors[household.KYCTier]
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
			WeeklyReleasePcts: model.WeeklyReleasePcts, CurrentWeek: 1,
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
