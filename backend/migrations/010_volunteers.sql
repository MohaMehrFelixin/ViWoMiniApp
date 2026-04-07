-- 010_volunteers.sql
-- Persist volunteer registrations (currently frontend-only localStorage).

CREATE TABLE IF NOT EXISTS volunteers (
    id              BIGINT PRIMARY KEY,
    household_id    BIGINT REFERENCES households(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    national_code   VARCHAR(10),
    full_name       VARCHAR(200) NOT NULL,
    specialty       VARCHAR(100),           -- from VOLUNTEER_SPECIALTIES or custom:*
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    verified_at     TIMESTAMPTZ,
    verified_by     BIGINT REFERENCES admin_users(id),
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_volunteers_hh ON volunteers (household_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_tg ON volunteers (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers (status);
CREATE TRIGGER trg_volunteers_upd BEFORE UPDATE ON volunteers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
