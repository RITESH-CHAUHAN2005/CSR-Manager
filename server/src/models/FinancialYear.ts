import mongoose, { Schema, type Document } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface IFinancialYear extends Document {
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

const financialYearSchema = new Schema<IFinancialYear>(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const FinancialYear = mongoose.model<IFinancialYear>('FinancialYear', financialYearSchema)
