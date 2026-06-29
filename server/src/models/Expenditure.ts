import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export interface IExpenditure extends Document {
  date: string
  projectId: Types.ObjectId
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  category: string
  approvedBy: string
  amount: number
  description?: string
  reference?: string
  notes?: string
}

const expenditureSchema = new Schema<IExpenditure>(
  {
    date: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    category: { type: String, default: '', trim: true },
    approvedBy: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Expenditure = mongoose.model<IExpenditure>('Expenditure', expenditureSchema)
