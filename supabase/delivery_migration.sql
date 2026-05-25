-- Run this in the Supabase SQL editor before deploying the buy-bundle Edge Function.

-- Add delivery tracking columns to transactions (wallet purchases)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS delivery_status  TEXT    DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS transaction_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error   TEXT;

-- Add delivery tracking columns to orders (storefront purchases)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_status  TEXT    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transaction_code TEXT;

-- Index for fast admin lookups by delivery status
CREATE INDEX IF NOT EXISTS idx_transactions_delivery_status ON transactions (delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status       ON orders       (delivery_status);
