import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON } from './_shared.js'

// Server-side only (no UI nav). Records every admin write for compliance/audit.
export interface IAuditLog extends Document {
  userId?: Types.ObjectId
  userEmail: string
  userRole?: string
  action: 'create' | 'update' | 'delete' | 'login' | 'login_failed' | 'register' | 'approve' | 'reject'
  entity: string
  entityId?: string
  label?: string
  method: string
  path: string
  ip?: string
  statusCode?: number
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userEmail: { type: String, default: 'anonymous' },
    userRole: { type: String },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    label: { type: String },
    method: { type: String, required: true },
    path: { type: String, required: true },
    ip: { type: String },
    statusCode: { type: Number },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema)
