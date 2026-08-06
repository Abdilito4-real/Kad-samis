-- 013_notifications_realtime.sql
-- Notifications were only ever refreshed by client-side polling — this adds
-- the notifications table to Supabase's realtime publication so INSERT/UPDATE
-- events push to subscribed clients instantly instead of waiting on a poll.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END$$;

-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry the full old row
-- (default identity only includes the primary key), which the client
-- subscription relies on to resync read/unread state.
ALTER TABLE notifications REPLICA IDENTITY FULL;
