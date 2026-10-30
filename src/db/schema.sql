-- ============================================================
-- UDANT — Agricultural B2B Marketplace
-- Phase 1 Database Schema (PostgreSQL)
-- Covers: locations, users/roles, profiles, commodities, listings
-- Phase 2+ entities (RFQ, offers, orders, shipments, messaging,
-- notifications, price_records, disputes) are noted at the bottom
-- so the schema can grow without breaking this foundation.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------- ENUMS ----------
CREATE TYPE user_role AS ENUM ('farmer', 'supplier', 'buyer', 'logistics_provider', 'admin');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE price_type AS ENUM ('fixed', 'negotiable', 'per_unit_market_linked');
CREATE TYPE listing_status AS ENUM ('active', 'paused', 'sold_out', 'expired', 'removed');

-- ---------- LOCATIONS ----------
CREATE TABLE states (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(10)  UNIQUE
);

CREATE TABLE districts (
    id          SERIAL PRIMARY KEY,
    state_id    INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    UNIQUE (state_id, name)
);
CREATE INDEX idx_districts_state ON districts(state_id);

-- ---------- USERS & AUTH ----------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20)  UNIQUE,
    password_hash   TEXT, -- Made optional for OTP-only accounts
    otp             VARCHAR(10), -- Added for OTP flow
    otp_expires_at  TIMESTAMPTZ, -- Added for OTP flow
    role            user_role NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_users_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE auth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL, -- 'refresh' | 'password_reset' | 'otp' | 'email_verify'
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, type);

-- ---------- PROFILES ----------
CREATE TABLE farmer_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    farm_name           VARCHAR(200),
    state_id            INTEGER REFERENCES states(id),
    district_id         INTEGER REFERENCES districts(id),
    address             TEXT,
    farm_size_acres     NUMERIC(10,2),
    production_capacity_mt NUMERIC(12,2),
    certifications      TEXT[],
    verification_status verification_status NOT NULL DEFAULT 'unverified',
    rating_avg          NUMERIC(3,2) DEFAULT 0,
    rating_count        INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_farmer_location ON farmer_profiles(state_id, district_id);

CREATE TABLE business_profiles (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name        VARCHAR(200) NOT NULL,
    business_type        VARCHAR(50) NOT NULL,
    gstin                VARCHAR(15),
    pan                  VARCHAR(10),
    address              TEXT,
    state_id             INTEGER REFERENCES states(id),
    district_id          INTEGER REFERENCES districts(id),
    annual_trading_capacity_mt NUMERIC(14,2),
    certifications       TEXT[],
    verification_status  verification_status NOT NULL DEFAULT 'unverified',
    rating_avg           NUMERIC(3,2) DEFAULT 0,
    rating_count         INTEGER DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_location ON business_profiles(state_id, district_id);
CREATE UNIQUE INDEX idx_business_gstin ON business_profiles(gstin) WHERE gstin IS NOT NULL;

CREATE TABLE verification_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by     UUID REFERENCES users(id),
    status          verification_status NOT NULL,
    document_type   VARCHAR(50),
    document_ref    TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_user ON verification_records(user_id);

-- ---------- COMMODITIES (extensible catalog) ----------
CREATE TABLE commodity_categories (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE commodities (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES commodity_categories(id),
    name            VARCHAR(120) NOT NULL,
    default_unit    VARCHAR(20) NOT NULL DEFAULT 'MT',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, name)
);

CREATE TABLE commodity_varieties (
    id              SERIAL PRIMARY KEY,
    commodity_id    INTEGER NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    UNIQUE (commodity_id, name)
);

-- ---------- LISTINGS ----------
CREATE TABLE commodity_listings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commodity_id        INTEGER NOT NULL REFERENCES commodities(id),
    variety_id          INTEGER REFERENCES commodity_varieties(id),
    grade               VARCHAR(20),
    quantity            NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
    unit                VARCHAR(20) NOT NULL DEFAULT 'MT',
    min_order_quantity  NUMERIC(14,2),
    price_amount        NUMERIC(12,2) NOT NULL CHECK (price_amount >= 0),
    price_unit          VARCHAR(20) NOT NULL DEFAULT 'per_kg',
    price_type          price_type NOT NULL DEFAULT 'negotiable',
    state_id            INTEGER NOT NULL REFERENCES states(id),
    district_id         INTEGER REFERENCES districts(id),
    available_from      DATE,
    quality_parameters  JSONB,
    description         TEXT,
    images              TEXT[],
    status              listing_status NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_listings_commodity ON commodity_listings(commodity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_location ON commodity_listings(state_id, district_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_status ON commodity_listings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_seller ON commodity_listings(seller_id);
CREATE INDEX idx_listings_price ON commodity_listings(price_amount);
CREATE INDEX idx_listings_created ON commodity_listings(created_at DESC);
CREATE INDEX idx_listings_quality_params ON commodity_listings USING GIN (quality_parameters);

-- ---------- AUDIT LOG ----------
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ---------- updated_at trigger helper ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_farmer_updated BEFORE UPDATE ON farmer_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_business_updated BEFORE UPDATE ON business_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON commodity_listings FOR EACH ROW EXECUTE FUNCTION set_updated_at();