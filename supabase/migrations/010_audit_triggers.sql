-- 010_audit_triggers.sql
-- Generic audit trigger function to populate `audit_logs` on data changes.

-- Create audit function
CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_action TEXT;
  v_record_id UUID;
BEGIN
  -- Avoid logging the audit_logs table itself
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    v_old = to_jsonb(OLD);
    v_new = NULL;
    v_action = 'delete';
    v_record_id = OLD.id;
  ELSIF (TG_OP = 'INSERT') THEN
    v_old = NULL;
    v_new = to_jsonb(NEW);
    v_action = 'insert';
    v_record_id = NEW.id;
  ELSE
    v_old = to_jsonb(OLD);
    v_new = to_jsonb(NEW);
    v_action = 'update';
    v_record_id = NEW.id;
  END IF;

  INSERT INTO public.audit_logs (
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
  ) VALUES (
    NULLIF(auth.uid(), '')::uuid,
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new,
    NULL,
    NULL,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Attach triggers to application tables where audit trail is useful
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_assets_trigger') THEN
    CREATE TRIGGER audit_assets_trigger
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_users_trigger') THEN
    CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_requests_trigger') THEN
    CREATE TRIGGER audit_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_maintenance_requests_trigger') THEN
    CREATE TRIGGER audit_maintenance_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_profiles_trigger') THEN
    CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_organizations_trigger') THEN
    CREATE TRIGGER audit_organizations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_facilities_trigger') THEN
    CREATE TRIGGER audit_facilities_trigger
    AFTER INSERT OR UPDATE OR DELETE ON facilities
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_buildings_trigger') THEN
    CREATE TRIGGER audit_buildings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON buildings
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_asset_categories_trigger') THEN
    CREATE TRIGGER audit_asset_categories_trigger
    AFTER INSERT OR UPDATE OR DELETE ON asset_categories
    FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
  END IF;
END$$;

-- Note: ip_address and user_agent are left NULL. Application-level insertions
-- should include these fields when available (see server-side logging helpers).
