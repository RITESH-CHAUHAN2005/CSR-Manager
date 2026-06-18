import { Schema } from 'mongoose'

// Denormalized creator info, attached to every record so we can show "who created what"
// (activity dashboards) even if the user is later removed. Set in crudController.create.
export const createdByFields = {
  createdById: { type: Schema.Types.ObjectId, ref: 'User' },
  createdByEmail: { type: String, default: '' },
  createdByName: { type: String, default: '' },
}

// Shared toJSON transform: expose `id`, hide `_id`/`__v`.
export const baseToJSON = {
  virtuals: true,
  transform(_doc: unknown, ret: Record<string, unknown>) {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
    return ret
  },
}
