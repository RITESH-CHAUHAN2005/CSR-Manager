import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

// The F.Expense record: which project (by Project ID), whose money, how much, and when.
// Carry forward is NOT stored here — it is derived from funds received against a project
// minus what has been spent on it (see utils/carryForward.ts).
export interface IExpenditure extends Document {
  date: string // date of spend — never in the future
  projectId: Types.ObjectId
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  approvedBy: string
  amount: number
  description?: string
  reference?: string
}

const expenditureSchema = new Schema<IExpenditure>(
  {
    date: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    approvedBy: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Expenditure = mongoose.model<IExpenditure>('Expenditure', expenditureSchema)
