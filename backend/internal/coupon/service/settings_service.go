package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// SettingsService loads system_settings from Postgres and exposes typed
// accessors used by AllocationService and other consumers. The settings are
// cached in memory and reloaded on demand (after admin updates).
//
// Thread safety: all reads use RLock; reload acquires Lock for the brief
// swap of the cached snapshot. Concurrent CalculateAndIssue calls are safe.
type SettingsService struct {
	pool   *pgxpool.Pool
	logger *zap.Logger

	mu       sync.RWMutex
	snapshot settingsSnapshot
}

// settingsSnapshot is an immutable point-in-time view of all settings the
// allocation engine cares about. We swap the whole struct under Lock so
// readers always see a coherent view.
type settingsSnapshot struct {
	BaseAmounts             map[string]map[string]string  // ageGroup → category → amount
	SpecialFlagMultipliers  map[string]map[string]float64 // flag → category → multiplier
	LocationMultipliers     map[string]float64            // segment → multiplier (applies to all categories)
	KYCTierFactors          map[int]float64               // tier → factor
	WeeklyReleasePcts       [4]int
}

// NewSettingsService creates a new settings service and primes the cache.
// Returns an error if the initial load from Postgres fails — the engine
// cannot run with empty settings, so failing fast is correct here.
func NewSettingsService(ctx context.Context, pool *pgxpool.Pool, logger *zap.Logger) (*SettingsService, error) {
	s := &SettingsService{pool: pool, logger: logger}
	if err := s.Reload(ctx); err != nil {
		return nil, fmt.Errorf("settings_service: initial load: %w", err)
	}
	return s, nil
}

// Reload re-fetches all settings from Postgres and atomically swaps the
// cached snapshot. Called on startup and after every admin settings update.
func (s *SettingsService) Reload(ctx context.Context) error {
	rows, err := s.pool.Query(ctx, "SELECT key, value FROM system_settings")
	if err != nil {
		return fmt.Errorf("query settings: %w", err)
	}
	defer rows.Close()

	raw := map[string][]byte{}
	for rows.Next() {
		var key string
		var value []byte
		if err := rows.Scan(&key, &value); err != nil {
			return fmt.Errorf("scan setting: %w", err)
		}
		raw[key] = value
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("rows: %w", err)
	}

	snap := settingsSnapshot{
		BaseAmounts:            map[string]map[string]string{},
		SpecialFlagMultipliers: map[string]map[string]float64{},
		LocationMultipliers:    map[string]float64{},
		KYCTierFactors:         map[int]float64{},
		WeeklyReleasePcts:      [4]int{35, 25, 25, 15},
	}

	if v, ok := raw["allocation_base_amounts"]; ok {
		if err := json.Unmarshal(v, &snap.BaseAmounts); err != nil {
			s.logger.Warn("invalid allocation_base_amounts JSON, keeping defaults", zap.Error(err))
		}
	}
	if v, ok := raw["special_flag_multipliers"]; ok {
		if err := json.Unmarshal(v, &snap.SpecialFlagMultipliers); err != nil {
			s.logger.Warn("invalid special_flag_multipliers JSON, keeping defaults", zap.Error(err))
		}
	}
	if v, ok := raw["location_multipliers"]; ok {
		if err := json.Unmarshal(v, &snap.LocationMultipliers); err != nil {
			s.logger.Warn("invalid location_multipliers JSON, keeping defaults", zap.Error(err))
		}
	}
	if v, ok := raw["kyc_tier_factors"]; ok {
		// JSON keys are strings, convert to int.
		strMap := map[string]float64{}
		if err := json.Unmarshal(v, &strMap); err == nil {
			for k, val := range strMap {
				var tier int
				if _, err := fmt.Sscanf(k, "%d", &tier); err == nil {
					snap.KYCTierFactors[tier] = val
				}
			}
		} else {
			s.logger.Warn("invalid kyc_tier_factors JSON, keeping defaults", zap.Error(err))
		}
	}
	if v, ok := raw["weekly_release_pcts"]; ok {
		var pcts []int
		if err := json.Unmarshal(v, &pcts); err == nil && len(pcts) == 4 {
			snap.WeeklyReleasePcts = [4]int{pcts[0], pcts[1], pcts[2], pcts[3]}
		} else {
			s.logger.Warn("invalid weekly_release_pcts, keeping defaults", zap.Error(err))
		}
	}

	s.mu.Lock()
	s.snapshot = snap
	s.mu.Unlock()

	s.logger.Info("settings loaded",
		zap.Int("base_age_groups", len(snap.BaseAmounts)),
		zap.Int("special_flags", len(snap.SpecialFlagMultipliers)),
		zap.Int("locations", len(snap.LocationMultipliers)),
		zap.Int("kyc_tiers", len(snap.KYCTierFactors)),
		zap.Ints("weekly_pcts", snap.WeeklyReleasePcts[:]),
	)
	return nil
}

// snapshot returns a defensive copy of the current snapshot for callers that
// need to read more than one field. The maps inside the snapshot are NOT
// deep-copied — callers must not mutate them.
func (s *SettingsService) Snapshot() settingsSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshot
}

// GetBaseAmount returns the base amount for an age group + category, or "" if
// missing. Returns string (not float) to preserve precision through big.Float.
func (s *SettingsService) GetBaseAmount(ageGroup, category string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if amounts, ok := s.snapshot.BaseAmounts[ageGroup]; ok {
		return amounts[category]
	}
	return ""
}

// GetSpecialFlagMultiplier returns the multiplier for (flag, category), or 1.0
// if no multiplier is configured for this combination.
func (s *SettingsService) GetSpecialFlagMultiplier(flag, category string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if multipliers, ok := s.snapshot.SpecialFlagMultipliers[flag]; ok {
		if m, ok := multipliers[category]; ok {
			return m
		}
	}
	return 1.0
}

// GetLocationMultiplier returns the multiplier for a location segment, or 1.0
// if missing.
func (s *SettingsService) GetLocationMultiplier(segment string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if m, ok := s.snapshot.LocationMultipliers[segment]; ok {
		return m
	}
	return 1.0
}

// GetKYCTierFactor returns the multiplier for a KYC tier, or 1.0 if missing.
func (s *SettingsService) GetKYCTierFactor(tier int) (float64, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	f, ok := s.snapshot.KYCTierFactors[tier]
	return f, ok
}

// GetWeeklyReleasePcts returns the cycle release schedule.
func (s *SettingsService) GetWeeklyReleasePcts() [4]int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshot.WeeklyReleasePcts
}
