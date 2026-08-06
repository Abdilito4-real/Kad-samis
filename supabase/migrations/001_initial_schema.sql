-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'agency_admin',
  'ministry_admin',
  'department_head',
  'asset_officer',
  'maintenance_officer',
  'inspector',
  'auditor',
  'procurement_officer',
  'finance_officer',
  'read_only_user'
);

CREATE TYPE asset_condition AS ENUM (
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged'
);

CREATE TYPE asset_status AS ENUM (
  'active',
  'inactive',
  'disposal',
  'maintenance',
  'archived'
);

CREATE TYPE maintenance_status AS ENUM (
  'pending',
  'approved',
  'in_progress',
  'completed',
  'rejected'
);

CREATE TYPE maintenance_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE transfer_status AS ENUM (
  'requested',
  'approved',
  'rejected',
  'completed'
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role_id UUID NOT NULL,
  ministry_id UUID,
  department_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_ministry ON users(ministry_id);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_deleted ON users(deleted_at);

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_deleted ON roles(deleted_at);

-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_permissions_deleted ON permissions(deleted_at);

-- Role permissions junction table
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Ministries table
CREATE TABLE ministries (
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

CREATE INDEX idx_ministries_code ON ministries(code);
CREATE INDEX idx_ministries_deleted ON ministries(deleted_at);

-- Departments table
CREATE TABLE departments (
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

CREATE INDEX idx_departments_ministry ON departments(ministry_id);
CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_departments_deleted ON departments(deleted_at);

-- Facilities table
CREATE TABLE facilities (
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

CREATE INDEX idx_facilities_ministry ON facilities(ministry_id);
CREATE INDEX idx_facilities_code ON facilities(code);
CREATE INDEX idx_facilities_deleted ON facilities(deleted_at);

-- Buildings table
CREATE TABLE buildings (
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

CREATE INDEX idx_buildings_facility ON buildings(facility_id);
CREATE INDEX idx_buildings_deleted ON buildings(deleted_at);

-- Floors table
CREATE TABLE floors (
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

CREATE INDEX idx_floors_building ON floors(building_id);
CREATE INDEX idx_floors_deleted ON floors(deleted_at);

-- Rooms table
CREATE TABLE rooms (
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

CREATE INDEX idx_rooms_floor ON rooms(floor_id);
CREATE INDEX idx_rooms_deleted ON rooms(deleted_at);

-- Asset categories
CREATE TABLE asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  depreciation_rate DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_asset_categories_code ON asset_categories(code);
CREATE INDEX idx_asset_categories_deleted ON asset_categories(deleted_at);

-- Asset subcategories
CREATE TABLE asset_subcategories (
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

CREATE INDEX idx_asset_subcategories_category ON asset_subcategories(category_id);
CREATE INDEX idx_asset_subcategories_deleted ON asset_subcategories(deleted_at);

-- Assets table
CREATE TABLE assets (
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

CREATE INDEX idx_assets_number ON assets(asset_number);
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_building ON assets(building_id);
CREATE INDEX idx_assets_condition ON assets(condition);
CREATE INDEX idx_assets_deleted ON assets(deleted_at);

-- Asset images
CREATE TABLE asset_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_asset_images_asset ON asset_images(asset_id);

-- Asset documents
CREATE TABLE asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_asset_documents_asset ON asset_documents(asset_id);

-- Maintenance requests
CREATE TABLE maintenance_requests (
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

CREATE INDEX idx_maintenance_requests_asset ON maintenance_requests(asset_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_deleted ON maintenance_requests(deleted_at);

-- Maintenance logs
CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id),
  technician_id UUID NOT NULL REFERENCES users(id),
  log_entry TEXT NOT NULL,
  parts_used TEXT,
  hours_spent DECIMAL(6, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_maintenance_logs_request ON maintenance_logs(maintenance_request_id);

-- Inspections
CREATE TABLE inspections (
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

CREATE INDEX idx_inspections_asset ON inspections(asset_id);
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX idx_inspections_deleted ON inspections(deleted_at);

-- Inspection images
CREATE TABLE inspection_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_inspection_images_inspection ON inspection_images(inspection_id);

-- Asset transfers
CREATE TABLE asset_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  from_building_id UUID REFERENCES buildings(id),
  to_building_id UUID REFERENCES buildings(id),
  from_officer_id UUID REFERENCES users(id),
  to_officer_id UUID REFERENCES users(id),
  status transfer_status DEFAULT 'requested',
  transfer_date DATE,
  requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_asset_transfers_asset ON asset_transfers(asset_id);
CREATE INDEX idx_asset_transfers_status ON asset_transfers(status);
CREATE INDEX idx_asset_transfers_deleted ON asset_transfers(deleted_at);

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  bank_details TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_vendors_code ON vendors(code);
CREATE INDEX idx_vendors_deleted ON vendors(deleted_at);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  title TEXT NOT NULL,
  description TEXT,
  contract_value DECIMAL(15, 2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX idx_contracts_deleted ON contracts(deleted_at);

-- Procurements
CREATE TABLE procurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  contract_id UUID REFERENCES contracts(id),
  purchase_order_number TEXT,
  quantity INTEGER,
  unit_price DECIMAL(15, 2),
  total_price DECIMAL(15, 2),
  procurement_date DATE,
  delivery_date DATE,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_procurements_asset ON procurements(asset_id);
CREATE INDEX idx_procurements_vendor ON procurements(vendor_id);
CREATE INDEX idx_procurements_deleted ON procurements(deleted_at);

-- Warranties
CREATE TABLE warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  warranty_provider TEXT,
  coverage_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_warranties_asset ON warranties(asset_id);
CREATE INDEX idx_warranties_deleted ON warranties(deleted_at);

-- Asset depreciation
CREATE TABLE asset_depreciation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  depreciation_year INTEGER NOT NULL,
  depreciation_amount DECIMAL(15, 2),
  book_value DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (asset_id, depreciation_year)
);

CREATE INDEX idx_asset_depreciation_asset ON asset_depreciation(asset_id);

-- Asset history / audit trail
CREATE TABLE asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asset_history_asset ON asset_history(asset_id);
CREATE INDEX idx_asset_history_created ON asset_history(created_at);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Activity logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  description TEXT,
  resource_type TEXT,
  resource_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  related_resource_type TEXT,
  related_resource_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Dashboard cache
CREATE TABLE dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  dashboard_key TEXT NOT NULL,
  data JSONB,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, dashboard_key)
);

CREATE INDEX idx_dashboard_cache_user ON dashboard_cache(user_id);
CREATE INDEX idx_dashboard_cache_expires ON dashboard_cache(expires_at);

-- System settings
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  setting_type TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Seed initial data
INSERT INTO roles (name, description, is_system_role) VALUES
  ('super_admin', 'System Administrator with full access', true),
  ('agency_admin', 'Facilities Management Agency Administrator', true),
  ('ministry_admin', 'Ministry Level Administrator', true),
  ('department_head', 'Department Head', true),
  ('asset_officer', 'Asset Management Officer', true),
  ('maintenance_officer', 'Maintenance Officer', true),
  ('inspector', 'Asset Inspector', true),
  ('auditor', 'Internal Auditor', true),
  ('procurement_officer', 'Procurement Officer', true),
  ('finance_officer', 'Finance Officer', true),
  ('read_only_user', 'Read-Only Access User', true);

INSERT INTO asset_categories (name, code, description, depreciation_rate) VALUES
  ('Vehicles', 'VEH', 'Motor vehicles and transportation', 20),
  ('Furniture', 'FUR', 'Office and facility furniture', 10),
  ('Equipment', 'EQP', 'Machinery and equipment', 15),
  ('Electronics', 'ELC', 'Computers and electronic devices', 25),
  ('Infrastructure', 'INF', 'Buildings and infrastructure', 5),
  ('Medical', 'MED', 'Medical equipment and supplies', 20),
  ('Office Supplies', 'OFF', 'General office supplies', 30);
