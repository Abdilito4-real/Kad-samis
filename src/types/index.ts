export type UserRole = 
  | "super_admin"
  | "agency_admin"
  | "ministry_admin"
  | "department_head"
  | "asset_officer"
  | "maintenance_officer"
  | "inspector"
  | "auditor"
  | "procurement_officer"
  | "finance_officer"
  | "operational_manager"
  | "read_only_user";

export interface User {
  id: string;
  email: string;
  /** Set only for super_admin/operational_manager — used in place of email for display. */
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  ministryId: string | null;
  departmentId: string | null;
  organizationId: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  assetNumber: string;
  qrCode: string | null;
  barcode: string | null;
  name: string;
  categoryId: string;
  subcategoryId: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  depreciationRate: number | null;
  warrantyExpiry: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "damaged";
  status: "active" | "inactive" | "disposal" | "maintenance" | "archived";
  fundingSource: string | null;
  supplierId: string | null;
  latitude: number | null;
  longitude: number | null;
  buildingId: string | null;
  floorId: string | null;
  roomId: string | null;
  assignedOfficerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ministry {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headquartersAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  administratorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  ministryId: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  headId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  lga: string | null;
  ministryId: string;
  departmentId: string | null;
  facilityType: string;
  totalFloors: number | null;
  constructedYear: number | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Building {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  floors: number;
  constructedDate: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRequest {
  id: string;
  assetId: string;
  status: "pending" | "approved" | "in_progress" | "completed" | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  requestedBy: string;
  assignedTo: string | null;
  requestedDate: string;
  completedDate: string | null;
  costEstimate: number | null;
  costActual: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  createdAt: string;
}
