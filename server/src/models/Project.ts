import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON, createdByFields } from './_shared.js'

export interface IProject extends Document {
  name: string
  companyId: Types.ObjectId
  financialYearId: Types.ObjectId
  category: string
  location: string
  budget: number
  status: 'active' | 'completed'
  description: string
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: 'FinancialYear', required: true, index: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    budget: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    description: { type: String, default: '', trim: true },
    ...createdByFields,
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Project = mongoose.model<IProject>('Project', projectSchema)
