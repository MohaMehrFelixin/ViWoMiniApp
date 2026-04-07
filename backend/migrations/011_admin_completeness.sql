-- 011_admin_completeness.sql
--
-- Production readiness pass for admin panel:
--   1. Seed allocation engine settings so SettingsService can drive allocations from DB.
--   2. Add notice CRUD storage in Postgres (Redis is the read cache, Postgres is source of truth).
--   3. Fix data integrity for admin operations.

-- ============================================================
-- 1. Allocation engine settings
-- ============================================================
INSERT INTO system_settings (key, value) VALUES
    ('allocation_base_amounts', '{
      "infant_0_6m":   {"water": "270", "food": "0",     "fuel": "0.96", "hygiene": "10", "medical": "2.3", "energy": "3.5"},
      "infant_6_23m":  {"water": "300", "food": "4",     "fuel": "0.96", "hygiene": "10", "medical": "2.3", "energy": "3.5"},
      "child_2_4":     {"water": "330", "food": "8",     "fuel": "0.96", "hygiene": "3",  "medical": "2.3", "energy": "3.5"},
      "child_5_11":    {"water": "360", "food": "11",    "fuel": "0.96", "hygiene": "3",  "medical": "2.3", "energy": "3.5"},
      "teen_12_17":    {"water": "450", "food": "14",    "fuel": "0.96", "hygiene": "4",  "medical": "2.3", "energy": "3.5"},
      "adult_18_59":   {"water": "450", "food": "16.05", "fuel": "0.96", "hygiene": "4",  "medical": "2.3", "energy": "3.5"},
      "senior_60_64":  {"water": "450", "food": "16.05", "fuel": "0.96", "hygiene": "4",  "medical": "2.3", "energy": "3.5"},
      "elderly_65p":   {"water": "450", "food": "14",    "fuel": "0.96", "hygiene": "4",  "medical": "2.3", "energy": "3.5"}
    }'::jsonb),
    ('special_flag_multipliers', '{
      "pregnant":   {"food": 1.25, "medical": 1.50, "water": 1.10},
      "chronic":    {"medical": 14.00, "food": 1.10},
      "sanitary":   {"hygiene": 6.00},
      "disability": {"medical": 1.50, "hygiene": 1.30},
      "newborn":    {"food": 1.30, "hygiene": 1.50, "medical": 1.20}
    }'::jsonb),
    ('location_multipliers', '{
      "tehran": 0.80,
      "urban":  1.00,
      "rural":  1.20
    }'::jsonb),
    ('kyc_tier_factors', '{"1": 1.00, "2": 0.85, "3": 0.70}'::jsonb),
    ('rate_limits', '{
      "qr_generate":  {"rps": 3, "burst": 5},
      "redeem":       {"rps": 1, "burst": 3},
      "kyc_otp":      {"rps": 3, "burst": 3},
      "notices":      {"rps": 5, "burst": 10},
      "admin_auth":   {"rps": 1, "burst": 3}
    }'::jsonb),
    ('telegram_bot', '{"username": "ViWoMiniBot", "bot_id": "8693627825", "enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Notices: persistent CRUD store (Postgres source of truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
    id          VARCHAR(50) PRIMARY KEY,
    text        TEXT NOT NULL,
    text_fa     TEXT NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'warning', 'promo')),
    link        VARCHAR(500),
    active      BOOLEAN NOT NULL DEFAULT true,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_by  BIGINT REFERENCES admin_users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notices_active_order ON notices (active, sort_order);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notices_upd') THEN
        CREATE TRIGGER trg_notices_upd BEFORE UPDATE ON notices
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 3. Backfill kyc_status from existing households (mark as verified
-- if any member is kyc_verified, otherwise pending).
-- ============================================================
UPDATE households h SET kyc_status = 'verified'
WHERE kyc_status = 'pending' AND EXISTS (
    SELECT 1 FROM household_members m
    WHERE m.household_id = h.id AND m.kyc_verified = true
);

-- ============================================================
-- 4. Index additions for admin queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_households_province ON households (province_code);
CREATE INDEX IF NOT EXISTS idx_households_kyc_status ON households (kyc_status);
CREATE INDEX IF NOT EXISTS idx_redemptions_disputed ON coupon_redemptions (status) WHERE status = 'disputed';
CREATE INDEX IF NOT EXISTS idx_allocations_paused ON coupon_allocations (is_paused) WHERE is_paused = true;
