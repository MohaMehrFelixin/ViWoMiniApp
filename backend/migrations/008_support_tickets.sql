-- 008_support_tickets.sql
-- Support ticketing system for user issues, reports, and requests.

CREATE TABLE IF NOT EXISTS support_tickets (
    id               BIGINT PRIMARY KEY,
    household_id     BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,

    -- Ticket content
    category         VARCHAR(30) NOT NULL,
    priority         VARCHAR(10) NOT NULL DEFAULT 'normal',
    subject          VARCHAR(200) NOT NULL,
    description      TEXT NOT NULL,
    reference_code   VARCHAR(100),

    -- Lifecycle
    status           VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to      BIGINT,              -- admin user ID
    resolved_at      TIMESTAMPTZ,
    resolution_note  TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ticket_cat CHECK (category IN (
        'coupon_issue','account_issue','app_bug',
        'data_correction','corruption_report','critical_report'
    )),
    CONSTRAINT chk_ticket_priority CHECK (priority IN ('normal','high','urgent')),
    CONSTRAINT chk_ticket_status CHECK (status IN ('open','in_progress','resolved','closed'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_hh ON support_tickets (household_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tg ON support_tickets (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets (priority, status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets (created_at DESC);
CREATE TRIGGER trg_tickets_upd BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin replies / thread on a ticket
CREATE TABLE IF NOT EXISTS ticket_replies (
    id          BIGINT PRIMARY KEY,
    ticket_id   BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_type VARCHAR(10) NOT NULL DEFAULT 'user',   -- 'user' or 'admin'
    author_id   BIGINT NOT NULL,                        -- telegram_user_id or admin ID
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reply_author CHECK (author_type IN ('user','admin'))
);
CREATE INDEX IF NOT EXISTS idx_replies_ticket ON ticket_replies (ticket_id, created_at);
