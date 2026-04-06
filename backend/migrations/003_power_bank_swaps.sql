CREATE TABLE IF NOT EXISTS power_bank_swaps (
    id              BIGINT PRIMARY KEY,
    household_id    BIGINT NOT NULL REFERENCES households(id),
    member_id       BIGINT NOT NULL REFERENCES household_members(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    swap_code       VARCHAR(20) NOT NULL UNIQUE,
    center_id       BIGINT REFERENCES distribution_centers(id),
    picked_up_at    TIMESTAMPTZ,
    returned_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_swap_status CHECK (status IN ('pending','ready','picked_up','returned','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_swaps_household ON power_bank_swaps (household_id);
CREATE INDEX IF NOT EXISTS idx_swaps_status ON power_bank_swaps (status);
CREATE INDEX IF NOT EXISTS idx_swaps_code ON power_bank_swaps (swap_code);
CREATE TRIGGER trg_swaps_upd BEFORE UPDATE ON power_bank_swaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
