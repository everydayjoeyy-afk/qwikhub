-- ============================================================
-- Complaints (two-way support tickets)
-- Customer submits a complaint; admin replies; customer sees the reply
-- in their Updates feed (bell). Writes go only through SECURITY DEFINER
-- RPCs, consistent with the security hardening.
-- Run once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS complaints (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'Other',
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  reply_read  BOOLEAN NOT NULL DEFAULT false,  -- has the customer seen the reply?
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_user   ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Customers may READ their own complaints (for the Updates feed + history).
DROP POLICY IF EXISTS "complaints_own_read" ON complaints;
CREATE POLICY "complaints_own_read" ON complaints
  FOR SELECT USING (user_id = auth.uid());

-- All writes go through the RPCs below — block direct client writes.
REVOKE INSERT, UPDATE, DELETE ON complaints FROM authenticated, anon;

-- ── Customer RPCs ─────────────────────────────────────────────
-- Submit a complaint (self-scoped).
CREATE OR REPLACE FUNCTION submit_complaint(p_category text, p_message text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_message IS NULL OR length(trim(p_message)) < 3 THEN RAISE EXCEPTION 'Message too short'; END IF;
  INSERT INTO complaints (user_id, category, message)
  VALUES (v_uid, COALESCE(NULLIF(trim(p_category), ''), 'Other'), trim(p_message))
  RETURNING id INTO v_id;
  RETURN (SELECT to_jsonb(c) FROM complaints c WHERE c.id = v_id);
END;
$$;

-- Mark all of my unread admin replies as read (called when I open Updates).
CREATE OR REPLACE FUNCTION mark_complaint_replies_read()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE complaints SET reply_read = true
  WHERE user_id = auth.uid() AND admin_reply IS NOT NULL AND reply_read = false;
$$;

-- ── Admin RPCs (is_admin enforced) ────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_complaints()
RETURNS TABLE (
  id uuid, user_id uuid, category text, message text, status text,
  admin_reply text, replied_at timestamptz, reply_read boolean,
  created_at timestamptz, user_name text, user_phone text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Qualify users.id: this function has an OUT column named "id", so a bare
  -- "id" here would be ambiguous (variable vs column).
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  SELECT c.id, c.user_id, c.category, c.message, c.status,
         c.admin_reply, c.replied_at, c.reply_read, c.created_at,
         u.name, u.phone
  FROM complaints c
  LEFT JOIN users u ON u.id = c.user_id
  ORDER BY (c.status = 'open') DESC, c.created_at DESC;
END;
$$;

-- Reply to a complaint (sets reply, flags it unread for the customer, resolves by default).
CREATE OR REPLACE FUNCTION admin_reply_complaint(p_complaint_id uuid, p_reply text, p_resolve boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_reply IS NULL OR length(trim(p_reply)) = 0 THEN RAISE EXCEPTION 'Reply is empty'; END IF;
  UPDATE complaints
  SET admin_reply = trim(p_reply),
      replied_at  = NOW(),
      reply_read  = false,
      status      = CASE WHEN p_resolve THEN 'resolved' ELSE status END,
      updated_at  = NOW()
  WHERE id = p_complaint_id;
END;
$$;

-- Toggle status open/resolved without replying.
CREATE OR REPLACE FUNCTION admin_set_complaint_status(p_complaint_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_status NOT IN ('open','resolved') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE complaints SET status = p_status, updated_at = NOW() WHERE id = p_complaint_id;
END;
$$;

-- ── Execute grants ────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('submit_complaint','mark_complaint_replies_read',
                             'admin_get_complaints','admin_reply_complaint','admin_set_complaint_status')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END $$;
