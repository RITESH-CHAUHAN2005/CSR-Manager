import mongoose, { Schema, type Document, type Types } from 'mongoose'
import { baseToJSON } from './_shared.js'

export interface IProjectDocument extends Document {
  projectId: Types.ObjectId
  filename: string
  mimeType: string
  size: number
  data: Buffer
  uploadedById?: string
  uploadedByName?: string
  uploadedByEmail?: string
}

// Stored directly in MongoDB (not on disk) — the hosting free tier has no
// persistent disk, so bytes have to live somewhere durable. Kept as a separate
// collection (not embedded on Project) so listing/loading projects elsewhere in
// the app never has to pull file bytes over the wire.
const projectDocumentSchema = new Schema<IProjectDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
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

export const ProjectDocument = mongoose.model<IProjectDocument>('ProjectDocument', projectDocumentSchema)
