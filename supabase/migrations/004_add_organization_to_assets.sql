-- Add organization scoping to assets
ALTER TABLE IF EXISTS assets
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Index for faster filtering by organization
CREATE INDEX IF NOT EXISTS idx_assets_organization ON assets(organization_id);
