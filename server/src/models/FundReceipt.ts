import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export interface IFundReceipt extends Document {
  date: string
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  reference: string
  mode: 'NEFT' | 'RTGS' | 'Cheque'
  carryForward: number
  amount: number
}

const fundReceiptSchema = new Schema<IFundReceipt>(
  {
    date: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    reference: { type: String, required: true, trim: true },
    mode: { type: String, enum: ['NEFT', 'RTGS', 'Cheque'], required: true },
    carryForward: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const FundReceipt = mongoose.model<IFundReceipt>('FundReceipt', fundReceiptSchema)
