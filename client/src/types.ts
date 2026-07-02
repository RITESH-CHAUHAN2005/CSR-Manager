// Domain types — shared across the app. Mirror the backend Mongoose models (Phase 3).

export type Role = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
}

// Creator attribution present on operational records (projects/receipts/expenditures).
export interface CreatedBy {
  createdById?: string
  createdByEmail?: string
  createdByName?: string
}

// Admin user-management view.
export interface ManagedUser {
  id: string
  name: string
  email: string
  role: Role
  companyId?: { id: string; name: string } | string | null
  createdAt: string
}

// Payload to create an admin/editor/viewer account from the Admin Panel.
export interface NewUserInput {
  name: string
  email: string
  password: string
  role: 'admin' | 'editor' | 'viewer'
}

// A single field-level change captured on an update.
export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

// Activity log entry.
export interface AuditLogEntry {
  id: string
  userEmail: string
  userRole?: string
  action: string
  entity: string
  entityId?: string
  label?: string
  // Descriptive detail of the change (populated by the backend):
  before?: Record<string, unknown> // snapshot before delete/update
  after?: Record<string, unknown> // snapshot after create/update
  changes?: FieldChange[] // what changed on an update
  method: string
  path: string
  ip?: string
  createdAt: string
}

export interface Company {
  id: string
  name: string
  cin: string // Corporate Identification Number, e.g. U65920MH1994PLC080618
  contactPerson: string
  email: string
  phone: string
  address?: string // registered address
  notes?: string // free-form notes
}

export interface FinancialYear {
  id: string
  name: string // "FY 2022-23"
  startDate: string // ISO yyyy-mm-dd
  endDate: string // ISO yyyy-mm-dd
  isActive: boolean
}

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'

export interface Project extends CreatedBy {
  id: string
  name: string
  companyId: string
  financialYearId: string
  category: string // Education, Environment, Skill Development, Healthcare...
  location: string
  budget: number
  status: ProjectStatus
  ongoing?: boolean // still running, no fixed end date
  description: string
  startDate?: string
  endDate?: string
  notes?: string
}

export type PaymentMode = 'NEFT' | 'RTGS' | 'Cheque'

export interface FundReceipt extends CreatedBy {
  id: string
  date: string // ISO yyyy-mm-dd
  companyId: string
  financialYearId: string
  reference: string // TCS/CSR/2022-23/001
  mode: PaymentMode
  carryForward: number
  amount: number
  notes?: string
}

export interface Expenditure extends CreatedBy {
  id: string
  date: string // ISO yyyy-mm-dd
  projectId: string
  companyId: string
  financialYearId: string
  category: string // Infrastructure, Training, Equipment, Scholarships, Environment...
  approvedBy: string // Trustee Board, Executive Director...
  amount: number
  description?: string
  reference?: string
  notes?: string
}

// ---- Derived / aggregated shapes (computed, not stored) ----

export interface CompanyFundPosition {
  companyId: string
  companyName: string
  totalReceived: number
  carryForward: number
  expenditure: number
  balance: number
  projects: number
}

export interface YearFundFlow {
  financialYearId: string
  yearName: string
  fundsReceived: number
  carryForwardIn: number
  totalAvailable: number
  expenditure: number
  balance: number
  carryForwardOut: number
}

export interface DashboardSummary {
  totalBalance: number
  totalReceived: number
  totalExpenditure: number
  balanceThisYear: number
  receivedThisYear: number
  expenditureThisYear: number
  activeProjects: number
  completedProjects: number
  totalProjects: number
  yearWise: { year: string; received: number; expenditure: number }[]
  companyDistribution: { companyName: string; received: number; percent: number }[]
  companyPositions: CompanyFundPosition[]
}
