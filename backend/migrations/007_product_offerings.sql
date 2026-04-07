-- 007_product_offerings.sql
-- Citizens can offer products they have available during the crisis.
-- Admin reviews and contacts them. Products are returned at 2x value
-- or equivalent price paid by government.

CREATE TABLE IF NOT EXISTS product_offerings (
    id               BIGINT PRIMARY KEY,
    household_id     BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,

    product_name     VARCHAR(200) NOT NULL,
    product_name_fa  VARCHAR(200) NOT NULL DEFAULT '',
    quantity         NUMERIC(20,2) NOT NULL,
    unit             VARCHAR(20) NOT NULL,
    description      TEXT NOT NULL DEFAULT '',

    -- Admin workflow
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes      TEXT NOT NULL DEFAULT '',
    reviewed_by      BIGINT,          -- admin user ID
    reviewed_at      TIMESTAMPTZ,
    contacted_at     TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_po_status CHECK (status IN ('pending','reviewing','contacted','accepted','rejected','collected')),
    CONSTRAINT chk_po_qty CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_po_hh ON product_offerings (household_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON product_offerings (status);
CREATE INDEX IF NOT EXISTS idx_po_tg ON product_offerings (telegram_user_id);
CREATE TRIGGER trg_po_upd BEFORE UPDATE ON product_offerings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
