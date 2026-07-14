import mongoose, { Schema, type Document } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface ICompany extends Document {
  name: string
  cin: string
  pan: string
  contactPerson: string
  email: string
  phone: string
  address: string
  description: string
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    // Only the company name is mandatory; the rest of the donor profile is optional.
    cin: { type: String, default: '', trim: true },
    // Permanent Account Number, e.g. AAACT2727Q. Stored uppercase.
    pan: { type: String, default: '', trim: true, uppercase: true },
    contactPerson: { type: String, default: '', trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    // Replaced the old `notes` field — one free-text field is enough.
    description: { type: String, default: '', trim: true },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const Company = mongoose.model<ICompany>('Company', companySchema)
