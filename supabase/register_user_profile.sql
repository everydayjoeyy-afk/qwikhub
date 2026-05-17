-- ============================================================
-- register_user_profile RPC
-- Called during signup with the anon key (no user session yet
-- because email confirmation is enabled).  SECURITY DEFINER
-- lets it bypass RLS and insert into users + referrals safely.
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_user_profile(
  p_user_id        UUID,
  p_name           TEXT,
  p_phone          TEXT,
  p_email          TEXT,
  p_referral_code  TEXT,
  p_referred_by    UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert user profile row
  INSERT INTO public.users (id, name, phone, email, referral_code, referred_by)
  VALUES (p_user_id, p_name, p_phone, p_email, p_referral_code, p_referred_by)
  ON CONFLICT (id) DO NOTHING;  -- safe retry if called twice

  -- Create referral record if user was referred
  IF p_referred_by IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id, commission_amount)
    VALUES (p_referred_by, p_user_id, 0)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Allow anon role to call this function (needed during signup before session exists)
GRANT EXECUTE ON FUNCTION public.register_user_profile TO anon, authenticated;
