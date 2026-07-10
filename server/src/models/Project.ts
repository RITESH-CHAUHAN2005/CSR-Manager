import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export type DerivedStatus = 'ongoing' | 'other'

export interface IProject extends Document {
  name: string
  companyIds: Types.ObjectId[]
  category: string
  location: string
  budget: number
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  // Ongoing = still running; end date auto-extends 4 years past the current FY.
  // Other = end date is fixed to the current FY's end date. Carry-forward for an
  // Ongoing project is recorded per-expenditure (see Expenditure.carryForwardAmount),
  // not on the project itself.
  derivedStatus: DerivedStatus
  description: string
  startDate?: string
  endDate?: string
  notes?: string
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
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
    notes: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Project = mongoose.model<IProject>('Project', projectSchema)
