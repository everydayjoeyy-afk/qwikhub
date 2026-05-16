-- Fix 1: allow sign-up to look up a referrer without RLS blocking it
CREATE OR REPLACE FUNCTION public.get_referrer_id(p_code text)
RETURNS uuid AS $$
  SELECT id FROM public.users WHERE referral_code = p_code LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referrer_id(text) TO authenticated;


-- Fix 2: return referrals with referred user info bypassing RLS
-- (RLS blocks reading other users' rows directly, so the join fails silently)
CREATE OR REPLACE FUNCTION public.get_my_referrals(p_user_id uuid)
RETURNS TABLE (
  id              uuid,
  referred_user_id uuid,
  commission_amount numeric,
  created_at      timestamptz,
  user_name       text,
  user_phone      text
) AS $$
  SELECT
    r.id,
    r.referred_user_id,
    r.commission_amount,
    r.created_at,
    u.name  AS user_name,
    u.phone AS user_phone
  FROM   public.referrals r
  LEFT JOIN public.users u ON u.id = r.referred_user_id
  WHERE  r.referrer_id = p_user_id
  ORDER  BY r.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_my_referrals(uuid) TO authenticated;
