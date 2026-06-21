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
  // Descriptive change detail for the activity feed:
  before?: Record<string, unknown> // snapshot before a delete/update
  after?: Record<string, unknown> // snapshot after a create/update
  changes?: { field: string; from: unknown; to: unknown }[] // field-level diff on update
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
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    changes: { type: [Schema.Types.Mixed], default: undefined },
    method: { type: String, required: true },
    path: { type: String, required: true },
    ip: { type: String },
    statusCode: { type: Number },
  },
  { timestamps: true, toJSON: baseToJSON },
)

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema)
