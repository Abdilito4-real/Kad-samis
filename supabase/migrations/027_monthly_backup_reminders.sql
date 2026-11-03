-- Deduplicate monthly reminder notifications and track scheduled delivery.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_idx
  ON public.notifications (user_id, dedupe_key);

CREATE TABLE IF NOT EXISTS public.monthly_backup_reminders (
  month_key TEXT PRIMARY KEY CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed')),
  notification_count INTEGER NOT NULL DEFAULT 0,
  email_sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.monthly_backup_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.monthly_backup_reminders FROM anon, authenticated;
GRANT ALL ON public.monthly_backup_reminders TO service_role;
