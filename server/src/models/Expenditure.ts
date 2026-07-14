import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

// The nature of a CSR spend, per the statutory expenditure heads.
export const NATURE_OF_EXPENSE = [
  'project_intervention',
  'administrative_overheads',
  'impact_assessment',
  'capital_asset',
  'other',
] as const
export type NatureOfExpense = (typeof NATURE_OF_EXPENSE)[number]

// Was the money spent by the company itself, or routed through the project's
// implementing agency (the Intervention Partner named on the Project)?
export const FUNDING_ROUTE = ['direct', 'intervention_partner'] as const
export type FundingRoute = (typeof FUNDING_ROUTE)[number]

// Only captured when natureOfExpense is 'capital_asset' — a CSR capital asset has to
// be reportable down to where it physically sits.
export interface ICapitalAsset {
  particulars: string
  address: string
  district: string
  state: string
  pinCode: string
  dateOfCreation: string
}

export interface IExpenditure extends Document {
  date: string // date of spend
  projectId: Types.ObjectId
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  natureOfExpense: NatureOfExpense
  // Free text, required when natureOfExpense is 'other'.
  otherNature: string
  capitalAsset: ICapitalAsset
  fundingRoute: FundingRoute
  approvedBy: string
  amount: number
  description?: string
  reference?: string
}

const capitalAssetSchema = new Schema<ICapitalAsset>(
  {
    particulars: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pinCode: { type: String, default: '', trim: true },
    dateOfCreation: { type: String, default: '' },
  },
  { _id: false },
)

const expenditureSchema = new Schema<IExpenditure>(
  {
    date: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    natureOfExpense: {
      type: String,
      enum: NATURE_OF_EXPENSE,
      default: 'project_intervention',
    },
    otherNature: { type: String, default: '', trim: true },
    capitalAsset: { type: capitalAssetSchema, default: () => ({}) },
    fundingRoute: { type: String, enum: FUNDING_ROUTE, default: 'direct' },
    approvedBy: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Expenditure = mongoose.model<IExpenditure>('Expenditure', expenditureSchema)
