// Domain types — shared across the app. Mirror the backend Mongoose models (Phase 3).

export type Role = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
  // Set true by the backend after an admin approves a password-reset request (the
  // account is on a temporary password). The app forces a change before letting the
  // user in, and clears it once they set their own password.
  mustChangePassword?: boolean
}

// A help-desk / support ticket raised by any signed-in user (or the login "forgot
// password" flow). type 'password' = a password-reset request the admin approves
// (which resets the account to a temporary password); type 'general' = a free-text
// problem with a subject the admin replies to.
export interface SupportRequest {
  id: string
  userId: string
  name: string
  email: string
  type: 'password' | 'general'
  subject: string
  message: string
  status: 'pending' | 'approved' | 'rejected' | 'resolved'
  reply?: string // admin's reply, for a 'general' request
  resolvedByEmail?: string
  createdAt: string
}

// Every server-side export target: the five Report tabs plus the raw per-page tables.
// Drives GET /reports/export/{pdf|excel}?type=<ExportType>.
export type ExportType =
  | 'year'
  | 'company'
  | 'project'
  | 'carryForward'
  | 'ledger'
  | 'companies'
  | 'company-detail' // one company's records (needs a companyId param)
  | 'projects'
  | 'fund-receipts'
  | 'expenditures'
  | 'financial-years'
  | 'master-data'
  | 'users'
  | 'activity-logs'

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
  pan?: string // Permanent Account Number, e.g. AAACT2727Q
  contactPerson: string
  email: string
  phone: string
  address?: string // registered address
  description?: string // free-form notes about the donor
}

export interface FinancialYear {
  id: string
  name: string // "FY 2022-23"
  startDate: string // ISO yyyy-mm-dd
  endDate: string // ISO yyyy-mm-dd
  isActive: boolean
}

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'
// Ongoing = still running; end date auto-extends 3 years past the start FY.
// Other than Ongoing = ends within the FY it started in (that FY's end date).
export type DerivedStatus = 'ongoing' | 'other'

export interface Project extends CreatedBy {
  id: string
  name: string
  // Business key shown wherever the project is referenced: 4 letters of the name +
  // the start year of its FY, e.g. RURA2025. Issued server-side and then fixed.
  projectCode?: string
  // The companies funding this project. What each has actually paid is derived from
  // its Fund Receipts, never stored here.
  companyIds: string[]
  category: string // a Schedule VII activity head, from Master Data
  location: string
  // The implementing agency delivering the project, when it isn't run directly.
  interventionPartner?: string
  // Approved cost of the project.
  budget: number
  status: ProjectStatus
  derivedStatus: DerivedStatus
  description: string
  startDate?: string
  endDate?: string // computed server-side, not user-editable
  financialYearId?: string // the FY the start date falls into; derived server-side
}

export type PaymentMode = 'NEFT' | 'RTGS' | 'Cheque' | ''

// 'company' = a Donor Company's direct contribution; 'other_source' = income earned
// on that company's funds via a Master Data Source (Interest/SIP/FD…). Both carry a
// company — money only ever arrives on behalf of one.
export type FundReceiptType = 'company' | 'other_source'

export interface FundReceipt extends CreatedBy {
  id: string
  date: string // ISO yyyy-mm-dd
  receiptType: FundReceiptType
  companyId?: string // required for both types — money always belongs to a company
  source?: string // Master Data "source" value — set when receiptType is 'other_source'
  financialYearId: string
  projectId?: string // optional link to the project this receipt funds
  reference: string // now labeled "Account Number" in the UI
  mode?: PaymentMode // no longer collected on the form; kept for historical records
  carryForward?: number // no longer collected on the form; kept for historical records
  amount: number
  description?: string
}

// ---- Master Data (Category / Status / Source) ----

export type MasterDataType = 'category' | 'status' | 'source'

export interface MasterDataItem {
  id: string
  type: MasterDataType
  value: string
  // What the value covers — carries the full Schedule VII clause for CSR categories.
  description?: string
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

// ---- Fund receipt document attachments (proof of payment — metadata only) ----

export interface FundReceiptDocumentMeta {
  id: string
  fundReceiptId: string
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
  date: string // date of spend, ISO yyyy-mm-dd — never in the future
  projectId: string
  companyId: string
  financialYearId: string
  approvedBy: string // Trustee Board, Executive Director...
  amount: number
  description?: string
  reference?: string
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

// Unspent money on an Ongoing project, per contributing company. Derived from
// receipts minus expenditure — see lib/carryForward.ts.
export interface CarryForwardRow {
  projectId: string
  projectCode: string
  projectName: string
  companyId: string
  companyName: string
  received: number
  spent: number
  carryForward: number
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
