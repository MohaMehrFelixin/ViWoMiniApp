-- 004_kyc_verification.sql
-- Add phone number support and KYC verification tracking

ALTER TABLE households ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);

ALTER TABLE household_members ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id              BIGINT PRIMARY KEY,
    household_id    BIGINT REFERENCES households(id),
    national_code   VARCHAR(10) NOT NULL,
    phone_number    VARCHAR(15) NOT NULL,
    shahkar_matched BOOLEAN NOT NULL DEFAULT FALSE,
    nid_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    track_id        VARCHAR(40) NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_household ON kyc_verifications(household_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_track_id ON kyc_verifications(track_id);
