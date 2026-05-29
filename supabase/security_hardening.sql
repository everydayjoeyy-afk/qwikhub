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
-- PART 2 — Money-RPC hardening (audit follow-up)
-- Closes: wallet theft via cross-user debit, referral over-credit,
-- commission spoofing, direct table writes to money columns, and
-- non-atomic withdrawals. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 9. Wallet debit — scope to the caller so a user can only debit
--    their OWN wallet (was: any user_id → cross-user wallet theft).
--    Body otherwise unchanged (still row-locked + atomic).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION debit_wallet_and_record(p_user_id uuid, p_total numeric, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_tx_ids  JSONB := '[]'::JSONB;
  v_item    JSONB;
  v_tx_id   UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT wallet_balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL      THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_balance < p_total    THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE users SET wallet_balance = wallet_balance - p_total WHERE id = p_user_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transactions (user_id, type, amount, description, delivery_status)
    VALUES (p_user_id, 'debit', (v_item->>'amount')::NUMERIC, v_item->>'description', v_item->>'delivery_status')
    RETURNING id INTO v_tx_id;
    v_tx_ids := v_tx_ids || jsonb_build_array(jsonb_build_object('id', v_tx_id));
  END LOOP;

  RETURN v_tx_ids;
END;
$$;

-- ------------------------------------------------------------
-- 10. Decrement earnings — scope to the caller.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_earnings(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF (SELECT earnings_balance FROM users WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;
  UPDATE users SET earnings_balance = earnings_balance - p_amount WHERE id = p_user_id;
END;
$$;

-- ------------------------------------------------------------
-- 11. Referral commission — drop the unused 1%-only overload, then
--     scope to the caller and CAP the commission so a spoofed client
--     amount can't exceed 10% of the amount paid (legit commission is
--     10% of PROFIT, which is always below that bound).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS record_referral_commission(uuid, numeric);

CREATE OR REPLACE FUNCTION record_referral_commission(
  p_buyer_user_id    uuid,
  p_amount_paid      numeric,
  p_commission_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_commission  NUMERIC;
  v_cap         NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_buyer_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, referrer_id INTO v_referral_id, v_referrer_id
  FROM referrals WHERE referred_user_id = p_buyer_user_id LIMIT 1;
  IF v_referrer_id IS NULL THEN RETURN; END IF;

  v_commission := COALESCE(p_commission_amount, p_amount_paid * 0.01);

  v_cap := p_amount_paid * 0.10;   -- safety bound; legit value is always lower
  IF v_commission > v_cap THEN v_commission := v_cap; END IF;
  IF v_commission <= 0   THEN RETURN; END IF;

  UPDATE referrals
  SET commission_amount = COALESCE(commission_amount, 0) + v_commission
  WHERE id = v_referral_id;
END;
$$;

-- ------------------------------------------------------------
-- 12. Referral transfer — fix the over-credit bug. The old version
--     summed the FULL commission_amount on a boolean flag, re-paying
--     prior transfers when a referral earned more. Now it transfers
--     only the untransferred DELTA (commission_amount - transferred_amount)
--     and stamps it atomically. Scoped to the caller.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_referral_earnings(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_amount NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(commission_amount - COALESCE(transferred_amount, 0)), 0) INTO v_amount
  FROM referrals
  WHERE referrer_id = p_user_id AND commission_amount > COALESCE(transferred_amount, 0);

  IF v_amount <= 0 THEN RETURN 0; END IF;

  UPDATE referrals
  SET transferred_amount = commission_amount, transferred = true
  WHERE referrer_id = p_user_id AND commission_amount > COALESCE(transferred_amount, 0);

  UPDATE users SET earnings_balance = earnings_balance + v_amount WHERE id = p_user_id;

  INSERT INTO transactions(user_id, type, amount, description)
  VALUES (p_user_id, 'credit', v_amount, 'Referral earnings transfer');

  RETURN v_amount;
END;
$$;

-- One-time data migration: mark already-transferred rows as fully settled so
-- the new delta logic never re-pays historical transfers.
UPDATE referrals
SET transferred_amount = commission_amount
WHERE transferred = true AND COALESCE(transferred_amount, 0) < commission_amount;

-- ------------------------------------------------------------
-- 13. Atomic withdrawal request — replaces the 3-call client sequence
--     (decrement → insert withdrawal → insert transaction), which could
--     leave money lost on partial failure and allowed a direct withdrawal
--     insert that bypassed the balance check. Self-scoped via auth.uid().
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION request_withdrawal(p_amount numeric, p_momo_number text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance NUMERIC;
  v_id      UUID;
BEGIN
  IF v_user_id IS NULL  THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount  < 50     THEN RAISE EXCEPTION 'Minimum withdrawal is 50'; END IF;

  SELECT earnings_balance INTO v_balance FROM users WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL     THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_balance < p_amount  THEN RAISE EXCEPTION 'Insufficient earnings balance'; END IF;

  UPDATE users SET earnings_balance = earnings_balance - p_amount WHERE id = v_user_id;

  INSERT INTO withdrawals (user_id, amount, momo_number, status)
  VALUES (v_user_id, p_amount, p_momo_number, 'pending')
  RETURNING id INTO v_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'debit', p_amount, 'Withdrawal request');

  RETURN (SELECT to_jsonb(w) FROM withdrawals w WHERE w.id = v_id);
END;
$$;

-- ------------------------------------------------------------
-- 14. Re-apply execute grants for the (re)created functions.
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('debit_wallet_and_record','decrement_earnings',
                             'record_referral_commission','transfer_referral_earnings',
                             'request_withdrawal')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 15. Lock down direct writes to money-bearing tables. All legitimate
--     writes now go through the SECURITY DEFINER RPCs above (which run as
--     the owner). This blocks a user from PATCHing their own
--     referrals.commission_amount or inserting an over-balance withdrawal.
--     SELECT is preserved (RLS still scopes reads to the owner).
-- ------------------------------------------------------------
REVOKE UPDATE, INSERT, DELETE ON referrals   FROM authenticated, anon;
REVOKE UPDATE, INSERT, DELETE ON withdrawals FROM authenticated, anon;

-- ============================================================
-- STILL LIVE-ONLY (dump from the DB and add for full reproducibility):
--   check_email_exists, and all admin_* functions.
-- Dump with: SELECT pg_get_functiondef('<schema>.<name>(<argtypes>)'::regprocedure);
-- Also still to verify server-side: every admin_* RPC enforces is_admin(auth.uid()).
-- ============================================================
