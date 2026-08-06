-- Create organization type and organizations table
CREATE TYPE organization_type AS ENUM ('MINISTRY', 'DEPARTMENT', 'AGENCY');

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

CREATE INDEX idx_organizations_name ON organizations(name);

-- Add organization_id to existing users table (optional linkage)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Profiles table to map auth users to application roles and organizations
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  role user_role DEFAULT 'read_only_user',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- Requests table for organization-admin requests to Super Admin
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE request_type AS ENUM ('asset_category','profile_update','password_reset','transfer','account_update');

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

CREATE INDEX idx_requests_org ON requests(organization_id);

-- Enable Row Level Security where appropriate
ALTER TABLE IF EXISTS requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Policy helpers: fetch current user's role and organization from profiles without recursive policy evaluation
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

-- Organization policies: Super admin full access, org admins can SELECT their own org
CREATE POLICY organizations_select_super_or_own ON organizations
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = organizations.id
  );

CREATE POLICY organizations_insert_super_only ON organizations
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY organizations_update_super_only ON organizations
  FOR UPDATE
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY organizations_delete_super_only ON organizations
  FOR DELETE
  USING (public.current_user_role() = 'super_admin');

-- Profiles policies: users can SELECT their own profile; super_admin can manage
CREATE POLICY profiles_select_own_or_super ON profiles
  FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'super_admin');

CREATE POLICY profiles_insert_super_only ON profiles
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY profiles_update_own_or_super ON profiles
  FOR UPDATE
  USING (id = auth.uid() OR public.current_user_role() = 'super_admin')
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'super_admin');

-- Requests policies: org admins can insert/select for their organization; super_admin can do everything
CREATE POLICY requests_select_super_or_org ON requests
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = requests.organization_id
  );

CREATE POLICY requests_insert_org_or_super ON requests
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = requests.organization_id
  );

CREATE POLICY requests_update_super_only ON requests
  FOR UPDATE
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY requests_delete_super_only ON requests
  FOR DELETE
  USING (public.current_user_role() = 'super_admin');
