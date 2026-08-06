-- 011_audit_seed.sql
-- Dev-only: insert a sample audit_logs row to verify UI and triggers.
-- Run this in the Supabase SQL editor (or via psql) while developing.

INSERT INTO public.audit_logs (
  id,
  user_id,
  action,
  table_name,
  record_id,
  old_values,
  new_values,
  ip_address,
  user_agent,
  timestamp,
  created_at
)
VALUES (
  gen_random_uuid(),
  NULL,
  'dev:insert',
  'assets',
  gen_random_uuid(),
  '{}'::jsonb,
  '{"name":"Dev asset","notes":"Inserted for audit UI test"}'::jsonb,
  '127.0.0.1',
  'dev-client',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
