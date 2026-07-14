import mongoose, { Schema, type Document } from 'mongoose'
import { baseToJSON } from './_shared.js'

export type MasterDataType = 'category' | 'status' | 'source'

export interface IMasterDataItem extends Document {
  type: MasterDataType
  value: string
  // What the value actually covers. Carries the full Schedule VII wording for the
  // statutory CSR categories, so the short 2–3 word dropdown label stays readable
  // while the legal definition is still one click away.
  description: string
}

const masterDataItemSchema = new Schema<IMasterDataItem>(
  {
    type: { type: String, enum: ['category', 'status', 'source'], required: true, index: true },
    value: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
  },
  { timestamps: true, toJSON: baseToJSON },
)

// A value can't be added twice under the same list.
masterDataItemSchema.index({ type: 1, value: 1 }, { unique: true })

export const MasterDataItem = mongoose.model<IMasterDataItem>('MasterDataItem', masterDataItemSchema)
