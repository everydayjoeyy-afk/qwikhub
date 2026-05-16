-- Fix: allow sign-up to look up a referral code without being blocked by RLS.
-- RLS only lets users read their own row, so we use SECURITY DEFINER to bypass it.

CREATE OR REPLACE FUNCTION public.get_referrer_id(p_code text)
RETURNS uuid AS $$
  SELECT id FROM public.users WHERE referral_code = p_code LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO authenticated;
