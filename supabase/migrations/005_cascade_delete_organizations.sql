-- Migration: Add cascading delete for organizations
-- Purpose: When an organization is deleted, automatically delete all related records

-- First, drop existing foreign key constraints
ALTER TABLE IF EXISTS profiles
DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;

ALTER TABLE IF EXISTS requests
DROP CONSTRAINT IF EXISTS requests_organization_id_fkey;

ALTER TABLE IF EXISTS assets
DROP CONSTRAINT IF EXISTS assets_organization_id_fkey;

-- Recreate foreign key constraints with ON DELETE CASCADE
ALTER TABLE profiles
ADD CONSTRAINT profiles_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
ON DELETE CASCADE;

ALTER TABLE requests
ADD CONSTRAINT requests_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
ON DELETE CASCADE;

ALTER TABLE assets
ADD CONSTRAINT assets_organization_id_fkey
FOREIGN KEY (organization_id)
REFERENCES organizations(id)
ON DELETE CASCADE;
