-- ============================================================
-- QwikHub — Security Hardening & Live-Only Object Definitions
-- Run in: Supabase Dashboard → SQL Editor (AFTER schema.sql,
-- wallet_rpc.sql, referral_fix.sql, register_user_profile.sql,
-- delivery_migration.sql)
--
-- This file captures objects that previously existed ONLY in the
-- live database (created manually) plus the access-control lockdown
-- applied during the security audit. Keeping it in version control
-- means the DB can be rebuilt reproducibly.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Withdrawable earnings balance (store profit + referral payouts)
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS earnings_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. Multi-item storefront carts share one Paystack reference, so
--    paystack_ref cannot be globally UNIQUE. Uniqueness is per line item.
-- ------------------------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_paystack_ref_key;
DROP INDEX IF EXISTS orders_paystack_ref_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ref_bundle_phone
  ON orders (paystack_ref, bundle_id, buyer_phone);

-- ------------------------------------------------------------
-- 3. Storefront order creation (SECURITY DEFINER).
--    NOTE: now superseded by the complete-store-order edge function,
--    which inserts orders directly via the service role. Kept for
--    reference / backward compatibility. Locked to service_role in §6.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_storefront_order(
  p_buyer_phone  TEXT,
  p_bundle_id    UUID,
  p_store_id     UUID,
  p_amount_paid  NUMERIC,
  p_profit       NUMERIC,
  p_paystack_ref TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO orders (buyer_phone, bundle_id, store_id, amount_paid, profit, paystack_ref, status)
  VALUES (p_buyer_phone, p_bundle_id, p_store_id, p_amount_paid, p_profit, p_paystack_ref, 'paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4. Credit withdrawable earnings (store profit / referral transfer).
--    Called by complete-store-order via the service role. Locked in §6.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_earnings(
  p_user_id     UUID,
  p_amount      NUMERIC,
  p_description TEXT,
  p_reference   TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET earnings_balance = earnings_balance + p_amount WHERE id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, description, reference)
  VALUES (p_user_id, 'credit', p_amount, p_description, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5. Decrement earnings on withdrawal request (called by the owner).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_earnings(
  p_user_id UUID,
  p_amount  NUMERIC
)
RETURNS VOID AS $$
BEGIN
  IF (SELECT earnings_balance FROM users WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;
  UPDATE users SET earnings_balance = earnings_balance - p_amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 6. ACCESS-CONTROL LOCKDOWN
--    SECURITY DEFINER functions run as their owner regardless of caller,
--    so we restrict WHO may invoke each one to its legitimate caller.
-- ------------------------------------------------------------

-- (a) No client caller — service_role only.
--     credit_earnings: only complete-store-order (service role) credits.
--     create_storefront_order: superseded; never called from the client.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('credit_earnings','create_storefront_order')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;

-- (b) Called by logged-in users — authenticated + service_role, never anon.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('decrement_earnings','transfer_referral_earnings','record_referral_commission')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7. The users table is READ-only to clients. All balance changes go
--    through the SECURITY DEFINER RPCs above (which run as the owner).
--    This blocks a logged-in user from PATCHing their own wallet_balance
--    / earnings_balance directly via the REST API.
-- ------------------------------------------------------------
REVOKE UPDATE, INSERT, DELETE ON users FROM authenticated, anon;

-- ------------------------------------------------------------
-- 8. Wallet top-up idempotency: a reference may only be credited once,
--    so concurrent webhook retries can't double-credit. Partial index
--    so the many NULL-reference rows (e.g. withdrawals) are unaffected.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference_unique
  ON transactions (reference) WHERE reference IS NOT NULL;

-- ============================================================
-- STILL LIVE-ONLY (not yet captured here — dump from the DB and add):
--   check_email_exists, debit_wallet_and_record,
--   record_referral_commission, transfer_referral_earnings,
--   and all admin_* functions.
-- Dump a definition with:
--   SELECT pg_get_functiondef('<schema>.<name>(<argtypes>)'::regprocedure);
-- ============================================================
