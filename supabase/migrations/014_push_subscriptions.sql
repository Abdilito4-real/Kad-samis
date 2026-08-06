-- 014_push_subscriptions.sql
-- Web Push subscriptions, one row per browser/device a user has enabled
-- push notifications on. Sending (src/lib/supabase/serverHelpers.ts,
-- writeNotifications) looks these up across users via the service-role
-- client — same reason the notifications-recipient lookups needed it
-- earlier: profiles_select_own_or_super-style "only your own row" RLS would
-- otherwise make the sender see nobody's subscriptions but their own.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid());

-- The subscribe route upserts by endpoint (a re-subscribe on the same
-- device hits an existing row), which needs UPDATE rights too, not just
-- INSERT/DELETE.
DROP POLICY IF EXISTS push_subscriptions_update_own ON push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON push_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
