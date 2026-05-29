-- ============================================================
-- Admin: Storefront order monitoring
-- Run in Supabase SQL Editor. Both RPCs enforce is_admin server-side.
-- ============================================================

-- Rich list of storefront orders (store_id IS NOT NULL) with store, owner,
-- bundle, profit and delivery detail. Newest first.
CREATE OR REPLACE FUNCTION admin_get_storefront_orders(p_limit int DEFAULT 300)
RETURNS TABLE (
  order_id         uuid,
  created_at       timestamptz,
  buyer_phone      text,
  carrier          text,
  data_size        text,
  amount_paid      numeric,
  profit           numeric,
  status           text,
  delivery_status  text,
  transaction_code text,
  paystack_ref     text,
  store_id         uuid,
  store_name       text,
  store_slug       text,
  owner_name       text,
  owner_phone      text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT
    o.id, o.created_at, o.buyer_phone,
    b.carrier, b.data_size,
    o.amount_paid, o.profit, o.status, o.delivery_status,
    o.transaction_code, o.paystack_ref,
    s.id, s.store_name, s.store_slug,
    u.name, u.phone
  FROM orders o
  LEFT JOIN bundles b ON b.id = o.bundle_id
  LEFT JOIN stores  s ON s.id = o.store_id
  LEFT JOIN users   u ON u.id = s.user_id
  WHERE o.store_id IS NOT NULL
  ORDER BY o.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Set delivery_status on a storefront order (manual deliver / mark-failed).
CREATE OR REPLACE FUNCTION admin_set_order_delivery_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_status NOT IN ('delivered','pending','pending_verification')
    THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE orders SET delivery_status = p_status WHERE id = p_order_id;
END;
$$;

-- Lock down: admins (authenticated) + service_role only.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('admin_get_storefront_orders','admin_set_order_delivery_status')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END $$;
