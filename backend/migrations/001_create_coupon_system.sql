-- 001_create_coupon_system.sql
-- MiniViWo Coupon System — Telegram Mini App (PostgreSQL-only)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- HOUSEHOLDS
CREATE TABLE IF NOT EXISTS households (
    id               BIGINT PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    household_code   VARCHAR(20) NOT NULL,
    kyc_tier         INTEGER NOT NULL DEFAULT 1,
    address          TEXT NOT NULL DEFAULT '',
    lat              DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng              DOUBLE PRECISION NOT NULL DEFAULT 0,
    province_code    VARCHAR(5) NOT NULL DEFAULT 'XX',
    location_segment VARCHAR(20) NOT NULL DEFAULT 'urban',
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_household_kyc CHECK (kyc_tier BETWEEN 1 AND 3),
    CONSTRAINT chk_household_loc CHECK (location_segment IN ('tehran', 'urban', 'rural')),
    CONSTRAINT chk_household_status CHECK (status IN ('active', 'suspended', 'pending'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_tg ON households (telegram_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_households_code ON households (household_code);
CREATE TRIGGER trg_households_upd BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- HOUSEHOLD MEMBERS
CREATE TABLE IF NOT EXISTS household_members (
    id            BIGINT PRIMARY KEY,
    household_id  BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    national_code VARCHAR(10) NOT NULL,
    full_name     VARCHAR(200) NOT NULL,
    birth_date    DATE NOT NULL,
    gender        VARCHAR(10) NOT NULL DEFAULT 'other',
    relationship  VARCHAR(50) NOT NULL,
    age_group     VARCHAR(30) NOT NULL,
    special_flags TEXT[] NOT NULL DEFAULT '{}',
    kyc_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_member_gender CHECK (gender IN ('male', 'female', 'other')),
    CONSTRAINT chk_member_nc CHECK (LENGTH(national_code) = 10)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_nc ON household_members (national_code);
CREATE INDEX IF NOT EXISTS idx_members_hh ON household_members (household_id);

-- COUPON ALLOCATIONS
CREATE TABLE IF NOT EXISTS coupon_allocations (
    id                   BIGINT PRIMARY KEY,
    household_id         BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    category             VARCHAR(20) NOT NULL,
    cycle_start          TIMESTAMPTZ NOT NULL,
    cycle_end            TIMESTAMPTZ NOT NULL,
    total_amount         NUMERIC(20,2) NOT NULL DEFAULT 0,
    used_amount          NUMERIC(20,2) NOT NULL DEFAULT 0,
    remaining_amount     NUMERIC(20,2) NOT NULL DEFAULT 0,
    weekly_release_pct_1 INTEGER NOT NULL DEFAULT 35,
    weekly_release_pct_2 INTEGER NOT NULL DEFAULT 25,
    weekly_release_pct_3 INTEGER NOT NULL DEFAULT 25,
    weekly_release_pct_4 INTEGER NOT NULL DEFAULT 15,
    current_week         INTEGER NOT NULL DEFAULT 1,
    status               VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alloc_cat CHECK (category IN ('water','food','fuel','hygiene','medical','energy')),
    CONSTRAINT chk_alloc_amt CHECK (total_amount >= 0 AND used_amount >= 0 AND remaining_amount >= 0),
    CONSTRAINT chk_alloc_status CHECK (status IN ('active','expired','exhausted')),
    CONSTRAINT chk_alloc_cycle CHECK (cycle_end > cycle_start),
    CONSTRAINT chk_alloc_pcts CHECK (weekly_release_pct_1+weekly_release_pct_2+weekly_release_pct_3+weekly_release_pct_4=100)
);
CREATE INDEX IF NOT EXISTS idx_alloc_hh ON coupon_allocations (household_id);
CREATE INDEX IF NOT EXISTS idx_alloc_hh_cat ON coupon_allocations (household_id, category);
CREATE INDEX IF NOT EXISTS idx_alloc_status ON coupon_allocations (status);

-- COUPON REDEMPTIONS (PostgreSQL, not ScyllaDB)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id                    BIGINT PRIMARY KEY,
    household_id          BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    allocation_id         BIGINT NOT NULL,
    category              VARCHAR(20) NOT NULL,
    amount                VARCHAR(20) NOT NULL,
    coupon_code           VARCHAR(50) NOT NULL,
    distribution_point_id BIGINT NOT NULL DEFAULT 0,
    redeemed_by_member_id BIGINT NOT NULL DEFAULT 0,
    qr_nonce              VARCHAR(100) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_redeem_status CHECK (status IN ('pending','completed','disputed','reversed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_nonce ON coupon_redemptions (qr_nonce);
CREATE INDEX IF NOT EXISTS idx_redeem_hh ON coupon_redemptions (household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redeem_hh_cat ON coupon_redemptions (household_id, category, created_at DESC);

-- DISTRIBUTION CENTERS
CREATE TABLE IF NOT EXISTS distribution_centers (
    id              BIGINT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(20) NOT NULL DEFAULT 'government',
    address         TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    categories      TEXT[] NOT NULL DEFAULT '{}',
    operating_hours VARCHAR(100) NOT NULL DEFAULT '08:00-20:00',
    queue_minutes   INTEGER NOT NULL DEFAULT 0,
    stock_status    JSONB NOT NULL DEFAULT '{}',
    province_code   VARCHAR(5) NOT NULL DEFAULT 'XX',
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_center_type CHECK (type IN ('government','private','mobile')),
    CONSTRAINT chk_center_status CHECK (status IN ('open','closed','low_stock','out_of_stock'))
);
CREATE INDEX IF NOT EXISTS idx_centers_status ON distribution_centers (status);
CREATE INDEX IF NOT EXISTS idx_centers_geo ON distribution_centers (lat, lng);
CREATE TRIGGER trg_centers_upd BEFORE UPDATE ON distribution_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
