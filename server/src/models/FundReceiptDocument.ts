import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface IFundReceiptDocument extends Document {
  fundReceiptId: Types.ObjectId
  filename: string
  mimeType: string
  size: number
  data: Buffer
  uploadedById?: string
  uploadedByName?: string
  uploadedByEmail?: string
}

// Proof of payment attached to a fund receipt (bank slip, cheque photo, statement…).
// Bytes live in MongoDB rather than on disk — the hosting free tier has no persistent
// disk — and in their own collection so listing receipts never pulls file bytes.
const fundReceiptDocumentSchema = new Schema<IFundReceiptDocument>(
  {
    fundReceiptId: { type: Schema.Types.ObjectId, ref: 'FundReceipt', required: true, index: true },
    filename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    uploadedById: { type: String },
    uploadedByName: { type: String },
    uploadedByEmail: { type: String },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const FundReceiptDocument = mongoose.model<IFundReceiptDocument>(
  'FundReceiptDocument',
  fundReceiptDocumentSchema,
)
