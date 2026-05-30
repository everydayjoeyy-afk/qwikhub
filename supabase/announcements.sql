-- ============================================================
-- Announcements (admin-broadcast updates shown to all users in the bell feed)
-- Replaces the temporary hardcoded list in src/lib/announcements.js.
-- Unread is tracked per-user via users.announcements_last_read_at.
-- Run once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,                                   -- optional "tap to open" URL
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);

-- Per-user "last read" marker for the unread badge
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS announcements_last_read_at TIMESTAMPTZ;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_read" ON announcements;
CREATE POLICY "announcements_read" ON announcements
  FOR SELECT USING (is_published = true);

-- Writes go through admin RPCs only.
REVOKE INSERT, UPDATE, DELETE ON announcements FROM authenticated, anon;

-- ── Customer RPCs ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_unread_announcement_count()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM announcements a
  WHERE a.is_published = true
    AND a.created_at > COALESCE(
      (SELECT announcements_last_read_at FROM users WHERE id = auth.uid()),
      '1970-01-01'::timestamptz
    );
$$;

CREATE OR REPLACE FUNCTION mark_announcements_read()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE users SET announcements_last_read_at = NOW() WHERE id = auth.uid();
$$;

-- ── Admin RPCs ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_announcements()
RETURNS SETOF announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY SELECT * FROM announcements ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_announcement(p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF p_body  IS NULL OR length(trim(p_body))  = 0 THEN RAISE EXCEPTION 'Body required';  END IF;
  INSERT INTO announcements (title, body, link, created_by)
  VALUES (trim(p_title), trim(p_body), NULLIF(trim(COALESCE(p_link, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN (SELECT to_jsonb(a) FROM announcements a WHERE a.id = v_id);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_announcement(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = TRUE)
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  DELETE FROM announcements WHERE id = p_id;
END;
$$;

-- ── Execute grants ────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname IN ('get_unread_announcement_count','mark_announcements_read',
                             'admin_get_announcements','admin_create_announcement','admin_delete_announcement')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END $$;

-- ── Seed the two current updates (only if the table is empty) ──
INSERT INTO announcements (title, body, link, created_at)
SELECT v.title, v.body, v.link, v.created_at
FROM (VALUES
  ('Store earnings now showing',
   'We''ve fixed the issue where storefront sales weren''t reflecting in your balance. Open My Store to see your earnings — your past sales are included.',
   NULL::text,
   NOW() - INTERVAL '1 hour'),
  ('Join our WhatsApp channel',
   'Get bundle updates, new features and exclusive offers first. Tap to follow our channel.',
   'https://whatsapp.com/channel/0029VbCc8oQ545uuu3uM7u3e',
   NOW() - INTERVAL '1 day')
) AS v(title, body, link, created_at)
WHERE NOT EXISTS (SELECT 1 FROM announcements);
