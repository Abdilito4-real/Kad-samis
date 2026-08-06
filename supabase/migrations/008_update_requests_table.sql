-- Update requests table to support escalation and proper request types

-- 1) Update request_status enum to include 'escalated'
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'escalated';

-- 2) Update request_type enum to include new types
-- Note: We need to use a different approach since we can't modify existing enum values directly
-- Create a new type if the old one doesn't have all values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'request_type' AND e.enumlabel = 'asset_approval') THEN
    -- Add values one by one (this works in PostgreSQL)
    ALTER TYPE request_type ADD VALUE IF NOT EXISTS 'asset_approval';
    ALTER TYPE request_type ADD VALUE IF NOT EXISTS 'transfer_approval';
    ALTER TYPE request_type ADD VALUE IF NOT EXISTS 'maintenance_approval';
    ALTER TYPE request_type ADD VALUE IF NOT EXISTS 'budget_request';
    ALTER TYPE request_type ADD VALUE IF NOT EXISTS 'general';
  END IF;
END$$;

-- 3) Add missing columns to requests table
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS related_asset_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS escalated_by UUID REFERENCES auth.users(id);

-- 4) Create index on created_by for performance
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_escalated ON requests(escalated_at);
CREATE INDEX IF NOT EXISTS idx_requests_status_org ON requests(status, organization_id);
