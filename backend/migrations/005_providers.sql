-- 005_providers.sql
-- Provider / Distributor / Service Provider system.
--
-- Key design decisions:
--   1. A provider is linked to a telegram_user_id, NOT household_id.
--      The same person keeps their household (coupon recipient) role intact.
--   2. Service types are admin-defined rows in provider_service_types, not enums.
--   3. Each provider is also linked to a distribution_centers row so existing
--      redemption tracking (distribution_point_id in coupon_redemptions) works.
--   4. Work sessions log open/close times for hour tracking.
--   5. provider_transactions records each item distributed (mirrors redemption
--      but from the provider's perspective for their dashboard stats).

-- ============================================================
-- ADMIN-DEFINED SERVICE TYPES
-- ============================================================
-- Admins create rows here; providers pick from this list.
-- Examples: "grocery", "bakery", "pharmacy", "distribution_assistant"
CREATE TABLE IF NOT EXISTS provider_service_types (
    id          BIGINT PRIMARY KEY,
    code        VARCHAR(50) NOT NULL,          -- machine key, e.g. "grocery"
    name        VARCHAR(200) NOT NULL,         -- English display name
    name_fa     VARCHAR(200) NOT NULL,         -- Persian display name
    description TEXT NOT NULL DEFAULT '',
    role        VARCHAR(30) NOT NULL DEFAULT 'distributor',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_stype_role CHECK (role IN ('distributor', 'service_provider'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stype_code ON provider_service_types (code);

-- Seed the essential service types
INSERT INTO provider_service_types (id, code, name, name_fa, role, sort_order) VALUES
    (1, 'grocery',                  'Grocery Store',            'بقالی / سوپرمارکت',      'distributor',       1),
    (2, 'bakery',                   'Bakery',                   'نانوایی',                  'distributor',       2),
    (3, 'pharmacy',                 'Pharmacy',                 'داروخانه',                 'distributor',       3),
    (4, 'butcher',                  'Butcher Shop',             'قصابی',                    'distributor',       4),
    (5, 'fuel_station',             'Fuel Station',             'جایگاه سوخت',              'distributor',       5),
    (6, 'water_station',            'Water Distribution Point', 'ایستگاه آب',               'distributor',       6),
    (7, 'general_goods',            'General Goods Store',      'فروشگاه عمومی',            'distributor',       7),
    (8, 'distribution_assistant',   'Distribution Assistant',   'دستیار توزیع',             'service_provider', 10),
    (9, 'medical_provider',         'Medical Service Provider', 'ارائه‌دهنده خدمات پزشکی',  'service_provider', 11),
    (10, 'hygiene_provider',        'Hygiene Supplies Provider','ارائه‌دهنده لوازم بهداشتی', 'service_provider', 12)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PROVIDERS  (the person / store)
-- ============================================================
-- A provider is a Telegram user who is approved to distribute goods.
-- They may ALSO have a household row for receiving their own coupons.
CREATE TABLE IF NOT EXISTS providers (
    id                    BIGINT PRIMARY KEY,
    telegram_user_id      BIGINT NOT NULL,
    household_id          BIGINT REFERENCES households(id) ON DELETE SET NULL,

    -- Identity
    name                  VARCHAR(200) NOT NULL,
    name_fa               VARCHAR(200) NOT NULL DEFAULT '',
    national_code         VARCHAR(10),           -- optional, already on household_members

    -- Store / service details
    service_type_id       BIGINT NOT NULL REFERENCES provider_service_types(id),
    store_address         TEXT NOT NULL DEFAULT '',
    store_address_fa      TEXT NOT NULL DEFAULT '',
    store_description     TEXT NOT NULL DEFAULT '',
    lat                   DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng                   DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Links this provider to a distribution_centers row so
    -- coupon_redemptions.distribution_point_id references it.
    distribution_point_id BIGINT REFERENCES distribution_centers(id) ON DELETE SET NULL,

    -- Categories this provider is authorised to distribute
    -- (admin-assigned). Empty = all categories allowed.
    allowed_categories    TEXT[] NOT NULL DEFAULT '{}',

    -- Lifecycle
    status                VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_at           TIMESTAMPTZ,
    approved_by           BIGINT,                -- admin user ID
    rejected_reason       TEXT,
    suspended_reason      TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_provider_status CHECK (status IN ('pending','approved','rejected','suspended'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_tg ON providers (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);
CREATE INDEX IF NOT EXISTS idx_providers_stype ON providers (service_type_id);
CREATE INDEX IF NOT EXISTS idx_providers_hh ON providers (household_id) WHERE household_id IS NOT NULL;
CREATE TRIGGER trg_providers_upd BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PROVIDER WORK SESSIONS  (open / close tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_sessions (
    id              BIGINT PRIMARY KEY,
    provider_id     BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL DEFAULT 0,    -- computed on close
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psessions_provider ON provider_sessions (provider_id, opened_at DESC);
-- Partial index: at most one open session per provider at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_psessions_active
    ON provider_sessions (provider_id)
    WHERE closed_at IS NULL;

-- ============================================================
-- PROVIDER TRANSACTIONS  (what they distributed)
-- ============================================================
-- Each row = one QR scan / redemption handled by this provider.
-- Links back to coupon_redemptions for the consumer side.
CREATE TABLE IF NOT EXISTS provider_transactions (
    id                  BIGINT PRIMARY KEY,
    provider_id         BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    redemption_id       BIGINT REFERENCES coupon_redemptions(id) ON DELETE SET NULL,
    household_id        BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    category            VARCHAR(20) NOT NULL,
    amount              VARCHAR(20) NOT NULL,
    item_description    TEXT NOT NULL DEFAULT '',
    item_description_fa TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ptx_cat CHECK (category IN ('water','food','fuel','hygiene','medical','energy'))
);
CREATE INDEX IF NOT EXISTS idx_ptx_provider ON provider_transactions (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ptx_provider_cat ON provider_transactions (provider_id, category);
CREATE INDEX IF NOT EXISTS idx_ptx_date ON provider_transactions (provider_id, created_at::date);

-- ============================================================
-- VIEWS  (convenient stats queries)
-- ============================================================

-- Daily summary per provider
CREATE OR REPLACE VIEW v_provider_daily_stats AS
SELECT
    provider_id,
    created_at::date AS work_date,
    category,
    COUNT(*)         AS tx_count,
    SUM(amount::numeric) AS total_amount
FROM provider_transactions
GROUP BY provider_id, created_at::date, category;

-- Work summary per provider (total days, total hours)
CREATE OR REPLACE VIEW v_provider_work_summary AS
SELECT
    provider_id,
    COUNT(DISTINCT opened_at::date) AS days_worked,
    ROUND(SUM(duration_minutes) / 60.0, 1) AS total_hours
FROM provider_sessions
WHERE closed_at IS NOT NULL
GROUP BY provider_id;
