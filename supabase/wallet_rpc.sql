-- Run this in Supabase SQL Editor AFTER schema.sql
-- These functions update wallet_balance atomically (SECURITY DEFINER bypasses RLS,
-- allowing unauthenticated storefront purchases to credit the seller's wallet).

CREATE OR REPLACE FUNCTION increment_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  IF (SELECT wallet_balance FROM users WHERE id = p_user_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  UPDATE users SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- credit_wallet: atomically increments wallet AND records the credit transaction.
-- Use this from the storefront (unauthenticated context) instead of calling
-- increment_wallet + a separate transactions insert, which would fail RLS.
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id     UUID,
  p_amount      NUMERIC,
  p_description TEXT,
  p_reference   TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, description, reference)
  VALUES (p_user_id, 'credit', p_amount, p_description, p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
