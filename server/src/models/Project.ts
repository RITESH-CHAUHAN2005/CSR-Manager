import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export interface IProject extends Document {
  name: string
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  category: string
  location: string
  budget: number
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  ongoing: boolean
  description: string
  startDate?: string
  endDate?: string
  notes?: string
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    category: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    budget: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'completed', 'on_hold', 'cancelled'],
      default: 'active',
    },
    // Marks a project that is still running with no fixed end date.
    ongoing: { type: Boolean, default: false },
    description: { type: String, default: '', trim: true },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    notes: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Project = mongoose.model<IProject>('Project', projectSchema)
