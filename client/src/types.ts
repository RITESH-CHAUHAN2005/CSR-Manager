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

// Payload to create an editor/viewer account from the Admin Panel.
export interface NewUserInput {
  name: string
  email: string
  password: string
  role: 'editor' | 'viewer'
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
}

export interface FinancialYear {
  id: string
  name: string // "FY 2022-23"
  startDate: string // ISO yyyy-mm-dd
  endDate: string // ISO yyyy-mm-dd
  isActive: boolean
}

export type ProjectStatus = 'active' | 'completed'

export interface Project extends CreatedBy {
  id: string
  name: string
  companyId: string
  financialYearId: string
  category: string // Education, Environment, Skill Development, Healthcare...
  location: string
  budget: number
  status: ProjectStatus
  description: string
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
