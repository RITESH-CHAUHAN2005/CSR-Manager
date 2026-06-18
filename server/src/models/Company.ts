import mongoose, { Schema, type Document } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface ICompany extends Document {
  name: string
  cin: string
  contactPerson: string
  email: string
  phone: string
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    cin: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Company = mongoose.model<ICompany>('Company', companySchema)
