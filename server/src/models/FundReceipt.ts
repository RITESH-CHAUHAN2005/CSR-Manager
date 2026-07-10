import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export type FundReceiptType = 'company' | 'other_source'

export interface IFundReceipt extends Document {
  date: string
  receiptType: FundReceiptType
  companyId?: Types.ObjectId
  source?: string
  financialYearId: Types.ObjectId
  projectId?: Types.ObjectId
  reference: string
  mode?: 'NEFT' | 'RTGS' | 'Cheque' | ''
  carryForward: number
  amount: number
  notes?: string
}

const fundReceiptSchema = new Schema<IFundReceipt>(
  {
    date: { type: String, required: true },
    // 'company' = a donor company's contribution; 'other_source' = income from a
    // Master Data "Source" (interest, SIP, FD…) not tied to any donor company.
    receiptType: { type: String, enum: ['company', 'other_source'], default: 'company' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    // Master Data "source" value (e.g. Interest, SIP, FD) — set when receiptType is 'other_source'.
    source: { type: String, default: '', trim: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    // Optional link to the project this receipt funds — a receipt doesn't have to
    // be tied to a specific project.
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    // "Account Number" in the UI — kept as `reference` in the schema to avoid a data migration.
    reference: { type: String, default: '', trim: true },
    // No longer collected on the add/edit form; kept optional for historical records.
    mode: { type: String, enum: ['NEFT', 'RTGS', 'Cheque', ''], default: '' },
    carryForward: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const FundReceipt = mongoose.model<IFundReceipt>('FundReceipt', fundReceiptSchema)
