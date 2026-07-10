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
// Ongoing = still running; end date auto-extends 4 years past the current FY.
// Other = end date is fixed to the current FY's end date.
export type DerivedStatus = 'ongoing' | 'other'

export interface Project extends CreatedBy {
  id: string
  name: string
  companyIds: string[]
  category: string // Education, Environment, Skill Development, Healthcare...
  location: string
  budget: number
  status: ProjectStatus
  derivedStatus: DerivedStatus
  description: string
  startDate?: string
  endDate?: string // computed server-side, not user-editable
  notes?: string
}

export type PaymentMode = 'NEFT' | 'RTGS' | 'Cheque' | ''

// 'company' = a Donor Company's contribution; 'other_source' = income from a
// Master Data Source (Interest/SIP/FD…), not tied to a donor company.
export type FundReceiptType = 'company' | 'other_source'

export interface FundReceipt extends CreatedBy {
  id: string
  date: string // ISO yyyy-mm-dd
  receiptType: FundReceiptType
  companyId?: string // required (Donor Company) when receiptType is 'company'; optional tag when 'other_source'
  source?: string // Master Data "source" value — set when receiptType is 'other_source'
  financialYearId: string
  projectId?: string // optional link to the project this receipt funds
  reference: string // now labeled "Account Number" in the UI
  mode?: PaymentMode // no longer collected on the form; kept for historical records
  carryForward?: number // no longer collected on the form; kept for historical records
  amount: number
  notes?: string
}

// ---- Master Data (Category / Status / Source) ----

export type MasterDataType = 'category' | 'status' | 'source'

export interface MasterDataItem {
  id: string
  type: MasterDataType
  value: string
}

// ---- Project document attachments (metadata only — bytes fetched via download URL) ----

export interface ProjectDocumentMeta {
  id: string
  projectId: string
  filename: string
  mimeType: string
  size: number
  uploadedByName?: string
  uploadedByEmail?: string
  createdAt?: string
}

// ---- Expenditure document attachments (metadata only — bytes fetched via download URL) ----

export interface ExpenditureDocumentMeta {
  id: string
  expenditureId: string
  filename: string
  mimeType: string
  size: number
  uploadedByName?: string
  uploadedByEmail?: string
  createdAt?: string
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
  // Only meaningful when the linked project is Ongoing — unused budget being
  // carried forward, recorded here rather than on the project itself.
  carryForwardAmount?: number
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
