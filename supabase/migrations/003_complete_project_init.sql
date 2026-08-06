-- KAD-SAMIS complete bootstrap SQL
-- Run this in the Supabase SQL editor to initialize the full project schema, seed data, and access policies.

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'super_admin',
      'agency_admin',
      'ministry_admin',
      'department_admin'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_condition') THEN
    CREATE TYPE asset_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'damaged');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status') THEN
    CREATE TYPE asset_status AS ENUM ('active', 'inactive', 'disposal', 'maintenance', 'archived');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status') THEN
    CREATE TYPE maintenance_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'rejected');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_priority') THEN
    CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE transfer_status AS ENUM ('requested', 'approved', 'rejected', 'completed');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type') THEN
    CREATE TYPE organization_type AS ENUM ('MINISTRY', 'DEPARTMENT', 'AGENCY');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_type') THEN
    CREATE TYPE request_type AS ENUM ('asset_category', 'profile_update', 'password_reset', 'transfer', 'account_update');
  END IF;
END$$;

-- 3) Core tables
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_type organization_type NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role_id UUID,
  ministry_id UUID,
  department_id UUID,
  organization_id UUID REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  headquarters_address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  administrator_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  location TEXT,
  phone TEXT,
  email TEXT,
  head_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (ministry_id, code)
);

CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  lga TEXT,
  ministry_id UUID NOT NULL REFERENCES ministries(id),
  department_id UUID REFERENCES departments(id),
  facility_type TEXT,
  total_floors INTEGER,
  constructed_year INTEGER,
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  floors INTEGER,
  constructed_date DATE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (facility_id, code)
);

CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id),
  floor_number INTEGER NOT NULL,
  name TEXT,
  total_rooms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (building_id, floor_number)
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES floors(id),
  name TEXT NOT NULL,
  room_number TEXT,
  room_type TEXT,
  square_feet DECIMAL(8, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  depreciation_rate DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS asset_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES asset_categories(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (category_id, code)
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number TEXT UNIQUE NOT NULL,
  qr_code TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES asset_categories(id),
  subcategory_id UUID REFERENCES asset_subcategories(id),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(15, 2),
  current_value DECIMAL(15, 2),
  depreciation_rate DECIMAL(5, 2),
  warranty_expiry DATE,
  condition asset_condition DEFAULT 'good',
  status asset_status DEFAULT 'active',
  funding_source TEXT,
  supplier_id UUID,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  building_id UUID REFERENCES buildings(id),
  floor_id UUID REFERENCES floors(id),
  room_id UUID REFERENCES rooms(id),
  assigned_officer_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS asset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  status maintenance_status DEFAULT 'pending',
  priority maintenance_priority DEFAULT 'medium',
  description TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_date TIMESTAMP WITH TIME ZONE,
  cost_estimate DECIMAL(15, 2),
  cost_actual DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id),
  technician_id UUID NOT NULL REFERENCES users(id),
  log_entry TEXT NOT NULL,
  parts_used TEXT,
  hours_spent DECIMAL(6, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  inspector_id UUID NOT NULL REFERENCES users(id),
  inspection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  condition asset_condition,
  notes TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  gps_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  role user_role DEFAULT 'read_only_user',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  title TEXT NOT NULL,
  type request_type NOT NULL,
  description TEXT,
  status request_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) Useful indexes
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_ministries_code ON ministries(code);
CREATE INDEX IF NOT EXISTS idx_departments_ministry ON departments(ministry_id);
CREATE INDEX IF NOT EXISTS idx_facilities_ministry ON facilities(ministry_id);
CREATE INDEX IF NOT EXISTS idx_assets_number ON assets(asset_number);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_building ON assets(building_id);
CREATE INDEX IF NOT EXISTS idx_requests_org ON requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

-- 5) Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_organizations_updated_at'
  ) THEN
    CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_users_updated_at'
  ) THEN
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_roles_updated_at'
  ) THEN
    CREATE TRIGGER set_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_permissions_updated_at'
  ) THEN
    CREATE TRIGGER set_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_ministries_updated_at'
  ) THEN
    CREATE TRIGGER set_ministries_updated_at
    BEFORE UPDATE ON ministries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_departments_updated_at'
  ) THEN
    CREATE TRIGGER set_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_facilities_updated_at'
  ) THEN
    CREATE TRIGGER set_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_buildings_updated_at'
  ) THEN
    CREATE TRIGGER set_buildings_updated_at
    BEFORE UPDATE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_floors_updated_at'
  ) THEN
    CREATE TRIGGER set_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_rooms_updated_at'
  ) THEN
    CREATE TRIGGER set_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_asset_categories_updated_at'
  ) THEN
    CREATE TRIGGER set_asset_categories_updated_at
    BEFORE UPDATE ON asset_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_asset_subcategories_updated_at'
  ) THEN
    CREATE TRIGGER set_asset_subcategories_updated_at
    BEFORE UPDATE ON asset_subcategories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_assets_updated_at'
  ) THEN
    CREATE TRIGGER set_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_maintenance_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_maintenance_requests_updated_at
    BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- 6) Seed default roles and permissions
INSERT INTO roles (name, description, is_system_role)
VALUES
  ('super_admin', 'Platform-wide administrator', true),
  ('agency_admin', 'Agency administrator', true),
  ('ministry_admin', 'Ministry administrator', true),
  ('department_admin', 'Department administrator', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action)
VALUES
  ('manage_organizations', 'Create and manage organizations', 'organizations', 'manage'),
  ('manage_users', 'Create and manage users', 'users', 'manage'),
  ('manage_assets', 'Create and manage assets', 'assets', 'manage'),
  ('view_assets', 'View asset inventory', 'assets', 'view'),
  ('manage_maintenance', 'Create and manage maintenance requests', 'maintenance_requests', 'manage'),
  ('view_reports', 'View dashboards and reports', 'reports', 'view'),
  ('manage_requests', 'Manage organization requests', 'requests', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to super admin
DO $$
DECLARE
  super_role_id UUID;
  permission_row RECORD;
BEGIN
  SELECT id INTO super_role_id FROM roles WHERE name = 'super_admin';

  IF super_role_id IS NOT NULL THEN
    FOR permission_row IN SELECT id FROM permissions LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (super_role_id, permission_row.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Seed initial asset categories
INSERT INTO asset_categories (name, code, description, depreciation_rate)
VALUES
  ('ICT Equipment', 'ICT', 'Computers, printers, network devices and related ICT equipment', 10.00),
  ('Office Furniture', 'FURN', 'Desks, chairs, cabinets and office furniture', 8.00),
  ('Vehicles', 'VEH', 'Government vehicles and transport assets', 15.00),
  ('Medical Equipment', 'MED', 'Medical and clinical equipment', 12.00),
  ('Building Infrastructure', 'BLD', 'Structural and building infrastructure assets', 5.00)
ON CONFLICT (code) DO NOTHING;

-- 7) Row Level Security setup
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS organizations_select_super_or_own ON organizations;
CREATE POLICY organizations_select_super_or_own ON organizations
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = organizations.id
  );

DROP POLICY IF EXISTS organizations_insert_super_only ON organizations;
CREATE POLICY organizations_insert_super_only ON organizations
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS organizations_update_super_only ON organizations;
CREATE POLICY organizations_update_super_only ON organizations
  FOR UPDATE
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS organizations_delete_super_only ON organizations;
CREATE POLICY organizations_delete_super_only ON organizations
  FOR DELETE
  USING (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS profiles_select_own_or_super ON profiles;
CREATE POLICY profiles_select_own_or_super ON profiles
  FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS profiles_insert_super_only ON profiles;
CREATE POLICY profiles_insert_super_only ON profiles
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS profiles_update_own_or_super ON profiles;
CREATE POLICY profiles_update_own_or_super ON profiles
  FOR UPDATE
  USING (id = auth.uid() OR public.current_user_role() = 'super_admin')
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS requests_select_super_or_org ON requests;
CREATE POLICY requests_select_super_or_org ON requests
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = requests.organization_id
  );

DROP POLICY IF EXISTS requests_insert_org_or_super ON requests;
CREATE POLICY requests_insert_org_or_super ON requests
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = requests.organization_id
  );

DROP POLICY IF EXISTS requests_update_super_only ON requests;
CREATE POLICY requests_update_super_only ON requests
  FOR UPDATE
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS requests_delete_super_only ON requests;
CREATE POLICY requests_delete_super_only ON requests
  FOR DELETE
  USING (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS assets_select_authenticated ON assets;
CREATE POLICY assets_select_authenticated ON assets
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS assets_insert_super_only ON assets;
CREATE POLICY assets_insert_super_only ON assets
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS assets_update_super_only ON assets;
CREATE POLICY assets_update_super_only ON assets
  FOR UPDATE
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- 8) Helpful example seed for a super-admin profile
-- Uncomment and replace the UUID with the actual Supabase Auth user ID after creating the first admin account.
-- INSERT INTO public.profiles (id, email, role, organization_id)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'admin@kaduna.gov.ng', 'super_admin', NULL);
