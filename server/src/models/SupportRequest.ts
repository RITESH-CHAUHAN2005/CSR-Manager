import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON } from './_shared.js'

// A user-initiated support request. Two flavours share one queue:
//  - type 'password': "I forgot my password" — an admin approves (resets the user to
//    a temporary password) or rejects.
//  - type 'general': a free-form help-desk message — an admin replies (resolves) it.
export interface ISupportRequest extends Document {
  userId: Types.ObjectId
  name?: string
  email?: string
  type: 'password' | 'general'
  subject?: string
  message?: string
  status: 'pending' | 'approved' | 'rejected' | 'resolved'
  reply?: string
  resolvedByEmail?: string
}

const supportRequestSchema = new Schema<ISupportRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String },
    email: { type: String, lowercase: true, trim: true },
    type: { type: String, enum: ['password', 'general'], required: true, index: true },
    subject: { type: String },
    message: { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'resolved'],
      default: 'pending',
      index: true,
    },
    reply: { type: String },
    resolvedByEmail: { type: String },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const SupportRequest = mongoose.model<ISupportRequest>(
  'SupportRequest',
  supportRequestSchema,
)
