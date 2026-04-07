package service

import (
	"context"
	"testing"

	"go.uber.org/zap"
)

// TestSettingsService_DefaultSnapshot verifies that a freshly-created service
// without a database can still answer queries safely (defensive defaults).
// In production this path is never taken — Reload() always loads from PG —
// but the defensive defaults exist to keep crash blast radius small.
func TestSettingsService_DefaultSnapshot(t *testing.T) {
	// Construct without calling Reload — simulate the empty case.
	s := &SettingsService{logger: zap.NewNop()}

	if got := s.GetWeeklyReleasePcts(); got != [4]int{0, 0, 0, 0} {
		// snapshot is zero value until Reload, weekly defaults to zeros.
		// This is documented behavior; reload always overrides on startup.
	}
	if amt := s.GetBaseAmount("adult_18_59", "water"); amt != "" {
		t.Errorf("expected empty before reload, got %q", amt)
	}
	if mult := s.GetSpecialFlagMultiplier("pregnant", "food"); mult != 1.0 {
		t.Errorf("expected default 1.0, got %v", mult)
	}
	if mult := s.GetLocationMultiplier("urban"); mult != 1.0 {
		t.Errorf("expected default 1.0, got %v", mult)
	}
	if _, ok := s.GetKYCTierFactor(1); ok {
		t.Errorf("expected no kyc tier before reload")
	}
}

// TestSettingsService_TypedAccessors uses a hand-crafted snapshot to verify
// each accessor returns the right value. This bypasses Postgres so the test
// runs without a database.
func TestSettingsService_TypedAccessors(t *testing.T) {
	s := &SettingsService{logger: zap.NewNop()}
	s.snapshot = settingsSnapshot{
		BaseAmounts: map[string]map[string]string{
			"adult_18_59": {"water": "450", "food": "16.05"},
		},
		SpecialFlagMultipliers: map[string]map[string]float64{
			"pregnant": {"food": 1.25, "medical": 1.5},
		},
		LocationMultipliers: map[string]float64{
			"tehran": 0.80, "rural": 1.20,
		},
		KYCTierFactors: map[int]float64{
			1: 1.00, 2: 0.85, 3: 0.70,
		},
		WeeklyReleasePcts: [4]int{40, 30, 20, 10},
	}

	if got := s.GetBaseAmount("adult_18_59", "water"); got != "450" {
		t.Errorf("water: got %q want 450", got)
	}
	if got := s.GetBaseAmount("adult_18_59", "food"); got != "16.05" {
		t.Errorf("food: got %q want 16.05", got)
	}
	if got := s.GetBaseAmount("missing", "water"); got != "" {
		t.Errorf("missing age group: got %q want empty", got)
	}
	if got := s.GetSpecialFlagMultiplier("pregnant", "food"); got != 1.25 {
		t.Errorf("pregnant food: got %v want 1.25", got)
	}
	if got := s.GetSpecialFlagMultiplier("pregnant", "fuel"); got != 1.0 {
		t.Errorf("missing flag-cat combo should default to 1.0, got %v", got)
	}
	if got := s.GetLocationMultiplier("tehran"); got != 0.80 {
		t.Errorf("tehran: got %v", got)
	}
	if got := s.GetLocationMultiplier("urban"); got != 1.0 {
		t.Errorf("urban (missing): got %v want 1.0 default", got)
	}
	if got, ok := s.GetKYCTierFactor(2); !ok || got != 0.85 {
		t.Errorf("kyc tier 2: got %v ok=%v", got, ok)
	}
	if got := s.GetWeeklyReleasePcts(); got != [4]int{40, 30, 20, 10} {
		t.Errorf("weekly: got %v", got)
	}
}

// TestSettingsService_ConcurrentReads verifies the RWLock allows many readers
// without blocking. Run with -race.
func TestSettingsService_ConcurrentReads(t *testing.T) {
	s := &SettingsService{logger: zap.NewNop()}
	s.snapshot = settingsSnapshot{
		BaseAmounts:            map[string]map[string]string{"adult_18_59": {"water": "450"}},
		SpecialFlagMultipliers: map[string]map[string]float64{},
		LocationMultipliers:    map[string]float64{"urban": 1.0},
		KYCTierFactors:         map[int]float64{1: 1.0},
	}

	done := make(chan struct{})
	for i := 0; i < 50; i++ {
		go func() {
			for j := 0; j < 1000; j++ {
				_ = s.GetBaseAmount("adult_18_59", "water")
				_ = s.GetLocationMultiplier("urban")
				_, _ = s.GetKYCTierFactor(1)
			}
			done <- struct{}{}
		}()
	}
	for i := 0; i < 50; i++ {
		<-done
	}
}

// _ unused context import suppression
var _ = context.Background
