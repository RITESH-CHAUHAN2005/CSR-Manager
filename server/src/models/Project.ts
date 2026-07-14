import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export type DerivedStatus = 'ongoing' | 'other'

export interface IProject extends Document {
  name: string
  // Human-readable business key shown everywhere a project is referenced, e.g.
  // RURA2025 = first 4 letters of the name + the start year of its financial year.
  // Generated server-side (assignProjectCode) and stable for the project's life —
  // renaming a project does NOT re-issue its code, since the code is already
  // printed on expenditures, receipts and exported reports.
  projectCode: string
  // The companies funding this project. Deduped on every write — see
  // normalizeProjectCompanies. What each has actually paid in is derived from its
  // Fund Receipts, never stored here.
  companyIds: Types.ObjectId[]
  category: string
  location: string
  // Free-text name of the implementing agency/NGO delivering the project, when it
  // isn't run directly. Expenditures record whether the spend went Direct or through
  // this partner.
  interventionPartner: string
  // The project's approved cost, entered by the user.
  budget: number
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  // Ongoing = still running; end date auto-extends 3 years past the start FY.
  // Other than Ongoing = ends within the start FY (its end date is that FY's end
  // date). Carry-forward for an Ongoing project is derived (funds received against
  // it minus spent on it) — see utils/carryForward.ts — never stored.
  derivedStatus: DerivedStatus
  description: string
  startDate?: string
  endDate?: string
  // The financial year the START DATE falls into. Never taken from the client —
  // derived alongside endDate in computeProjectDates middleware. Kept so the FY is
  // queryable/reportable without re-deriving from dates on every read.
  financialYearId?: Types.ObjectId
  notes?: string
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    projectCode: { type: String, default: '', trim: true, uppercase: true },
    companyIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one company is required',
      },
    },
    category: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    interventionPartner: { type: String, default: '', trim: true },
    budget: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'completed', 'on_hold', 'cancelled'],
      default: 'active',
    },
    derivedStatus: { type: String, enum: ['ongoing', 'other'], default: 'other' },
    description: { type: String, default: '', trim: true },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', index: true },
    notes: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

// Two projects can never share a code. Partial so that legacy rows that predate the
// field (no code, or an empty one) don't all collide on '' before the backfill runs.
projectSchema.index(
  { projectCode: 1 },
  { unique: true, partialFilterExpression: { projectCode: { $gt: '' } } },
)

export const Project = mongoose.model<IProject>('Project', projectSchema)
