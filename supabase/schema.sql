-- ============================================================
-- QwikHub Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT UNIQUE NOT NULL,
  email            TEXT UNIQUE,
  wallet_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  referral_code    TEXT UNIQUE NOT NULL,
  referred_by      UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name   TEXT NOT NULL,
  store_slug   TEXT UNIQUE NOT NULL,
  theme        TEXT NOT NULL DEFAULT 'midnight',
  is_live      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUNDLES (master catalogue — platform prices)
-- ============================================================
CREATE TABLE IF NOT EXISTS bundles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier        TEXT NOT NULL,           -- 'MTN' | 'Telecel' | 'AirtelTigo'
  data_size      TEXT NOT NULL,           -- '1GB' | '5GB' etc.
  validity_days  INT NOT NULL DEFAULT 30,
  platform_price NUMERIC(10,2) NOT NULL,  -- what QwikHub charges the reseller
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORE BUNDLES (reseller custom prices)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_bundles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  bundle_id    UUID NOT NULL REFERENCES bundles(id),
  custom_price NUMERIC(10,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(store_id, bundle_id)
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_phone    TEXT NOT NULL,
  bundle_id      UUID NOT NULL REFERENCES bundles(id),
  store_id       UUID REFERENCES stores(id),   -- NULL = bought from main app
  amount_paid    NUMERIC(10,2) NOT NULL,
  profit         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'paystack',
  paystack_ref   TEXT UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','paid','delivered','failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (wallet audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('credit','debit')),
  amount      NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id      UUID NOT NULL REFERENCES users(id),
  referred_user_id UUID NOT NULL REFERENCES users(id),
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

-- ============================================================
-- WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 50),
  momo_number TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','completed','failed')),
  reviewed_by TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_store_id    ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user    ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_store_bundles_store ON store_bundles(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug  ON stores(store_slug);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles      ENABLE ROW LEVEL SECURITY;

-- users: read/write own row only
CREATE POLICY "users_own" ON users
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- stores: owner full access; public read by slug (for storefront)
CREATE POLICY "stores_owner"  ON stores
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "stores_public_read" ON stores
  FOR SELECT USING (true);

-- store_bundles: owner manages; public reads active ones
CREATE POLICY "sb_owner"  ON store_bundles
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "sb_public_read" ON store_bundles
  FOR SELECT USING (is_active = true);

-- bundles: everyone can read active bundles; only service role writes
CREATE POLICY "bundles_public_read" ON bundles
  FOR SELECT USING (is_active = true);

-- orders: store owner sees their store's orders; buyer can insert
CREATE POLICY "orders_owner_read" ON orders
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  );

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (true);

-- transactions: own only
CREATE POLICY "transactions_own" ON transactions
  USING (user_id = auth.uid());

-- referrals: referrer can see theirs
CREATE POLICY "referrals_own" ON referrals
  USING (referrer_id = auth.uid());

-- withdrawals: own only
CREATE POLICY "withdrawals_own" ON withdrawals
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SEED: master bundle catalogue
-- ============================================================
INSERT INTO bundles (carrier, data_size, validity_days, platform_price) VALUES
  ('MTN','1GB',  30,  4.00),
  ('MTN','2GB',  30,  8.40),
  ('MTN','3GB',  30, 12.60),
  ('MTN','4GB',  30, 16.80),
  ('MTN','5GB',  30, 21.80),
  ('MTN','6GB',  30, 25.20),
  ('MTN','8GB',  30, 33.60),
  ('MTN','10GB', 30, 39.80),
  ('MTN','15GB', 30, 58.00),
  ('MTN','20GB', 30, 77.00),
  ('MTN','25GB', 30, 96.50),
  ('MTN','30GB', 30,116.00),
  ('MTN','40GB', 30,153.00),
  ('MTN','50GB', 30,191.00),
  ('MTN','100GB',30,345.00),
  ('Telecel','1GB',  30,  4.00),
  ('Telecel','2GB',  30,  8.40),
  ('Telecel','3GB',  30, 12.60),
  ('Telecel','4GB',  30, 16.80),
  ('Telecel','5GB',  30, 21.80),
  ('Telecel','6GB',  30, 25.20),
  ('Telecel','8GB',  30, 33.60),
  ('Telecel','10GB', 30, 39.80),
  ('Telecel','15GB', 30, 58.00),
  ('Telecel','20GB', 30, 77.00),
  ('Telecel','25GB', 30, 96.50),
  ('Telecel','30GB', 30,116.00),
  ('Telecel','40GB', 30,153.00),
  ('Telecel','50GB', 30,191.00),
  ('Telecel','100GB',30,345.00),
  ('AirtelTigo','1GB',  30,  4.00),
  ('AirtelTigo','2GB',  30,  8.40),
  ('AirtelTigo','3GB',  30, 12.60),
  ('AirtelTigo','4GB',  30, 16.80),
  ('AirtelTigo','5GB',  30, 21.80),
  ('AirtelTigo','6GB',  30, 25.20),
  ('AirtelTigo','8GB',  30, 33.60),
  ('AirtelTigo','10GB', 30, 39.80),
  ('AirtelTigo','15GB', 30, 58.00),
  ('AirtelTigo','20GB', 30, 77.00),
  ('AirtelTigo','25GB', 30, 96.50),
  ('AirtelTigo','30GB', 30,116.00),
  ('AirtelTigo','40GB', 30,153.00),
  ('AirtelTigo','50GB', 30,191.00),
  ('AirtelTigo','100GB',30,345.00)
ON CONFLICT DO NOTHING;
