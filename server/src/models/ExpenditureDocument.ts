import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface IExpenditureDocument extends Document {
  expenditureId: Types.ObjectId
  filename: string
  mimeType: string
  size: number
  data: Buffer
  uploadedById?: string
  uploadedByName?: string
  uploadedByEmail?: string
}

// Mirrors ProjectDocument — bytes stored directly in MongoDB (no persistent
// disk on the hosting free tier), kept as a separate collection so listing
// expenditures elsewhere never has to pull file bytes over the wire.
const expenditureDocumentSchema = new Schema<IExpenditureDocument>(
  {
    expenditureId: { type: Schema.Types.ObjectId, ref: 'Expenditure', required: true, index: true },
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

export const ExpenditureDocument = mongoose.model<IExpenditureDocument>(
  'ExpenditureDocument',
  expenditureDocumentSchema,
)
