-- 009_admin_panel.sql
-- Admin panel infrastructure: users, sessions, audit logs, system settings.
-- Security model: OTP-only auth, server-side Redis sessions, 10-level RBAC.

-- ============================================================
-- ADMIN USERS (10-level hierarchy)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id              BIGINT PRIMARY KEY,
    national_code   VARCHAR(10) UNIQUE NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(15) NOT NULL,
    birth_date      DATE,
    gender          VARCHAR(10),

    -- Hierarchy (1=viewer → 10=CEO)
    role_level      INTEGER NOT NULL DEFAULT 1
        CHECK (role_level >= 1 AND role_level <= 10),
    role_title      VARCHAR(50) NOT NULL DEFAULT 'viewer',
    province_codes  TEXT[] NOT NULL DEFAULT '{}',    -- regional scope (empty = global for L9-10)
    parent_admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,

    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'deactivated')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_role ON admin_users (role_level);
CREATE INDEX IF NOT EXISTS idx_admin_parent ON admin_users (parent_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_province ON admin_users USING GIN (province_codes);
CREATE INDEX IF NOT EXISTS idx_admin_status ON admin_users (status);
CREATE TRIGGER trg_admin_upd BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed super admin (CEO) — change national_code + phone in production
INSERT INTO admin_users (id, national_code, full_name, phone, role_level, role_title, status)
VALUES (1, '0000000000', 'System Admin', '09000000000', 10, 'ceo', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AUDIT LOGS (immutable append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT PRIMARY KEY,
    admin_id    BIGINT NOT NULL REFERENCES admin_users(id),
    action      VARCHAR(50) NOT NULL,       -- create, update, delete, approve, reject, login, logout, export
    entity_type VARCHAR(50) NOT NULL,       -- household, member, allocation, redemption, center, admin_user, etc.
    entity_id   BIGINT,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    user_agent  VARCHAR(500),
    session_id  VARCHAR(64),                -- links to the session that performed this action
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (created_at DESC);

-- Enforce immutability: audit logs cannot be updated or deleted.
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable — updates and deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ============================================================
-- SYSTEM SETTINGS (admin-configurable key/value)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  BIGINT REFERENCES admin_users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with current hardcoded values
INSERT INTO system_settings (key, value) VALUES
    ('weekly_release_pcts', '[35, 25, 25, 15]'),
    ('qr_expiry_minutes', '10'),
    ('geosearch_radius_km', '50'),
    ('session_timeout_minutes', '480'),
    ('max_otp_attempts', '3'),
    ('otp_cooldown_minutes', '5'),
    ('lockout_threshold', '5'),
    ('lockout_duration_minutes', '30')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ALTER EXISTING TABLES for admin tracking
-- ============================================================

-- Households: admin can suspend, add notes, track KYC status
ALTER TABLE households
    ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Redemptions: dispute resolution
ALTER TABLE coupon_redemptions
    ADD COLUMN IF NOT EXISTS dispute_reason VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS dispute_resolved_by BIGINT,
    ADD COLUMN IF NOT EXISTS dispute_resolution VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Distribution centers: admin management
ALTER TABLE distribution_centers
    ADD COLUMN IF NOT EXISTS managed_by BIGINT,
    ADD COLUMN IF NOT EXISTS last_modified_by BIGINT,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Allocations: admin adjustments
ALTER TABLE coupon_allocations
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(500);

-- Power bank swaps: admin overrides
ALTER TABLE power_bank_swaps
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS forced_by BIGINT;
