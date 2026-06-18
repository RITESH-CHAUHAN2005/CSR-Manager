import mongoose, { Schema, type Document, type Model } from 'mongoose'
import bcrypt from 'bcryptjs'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME_MS = 15 * 60 * 1000 // 15 minutes

export type Role = 'admin' | 'user'
export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  role: Role
  status: UserStatus
  companyId?: mongoose.Types.ObjectId
  loginAttempts: number
  lockUntil?: number
  isLocked(): boolean
  comparePassword(candidate: string): Promise<boolean>
}

interface IUserModel extends Model<IUser> {
  recordFailedLogin(id: mongoose.Types.ObjectId): Promise<void>
  resetLoginAttempts(id: mongoose.Types.ObjectId): Promise<void>
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Number },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash
        delete ret.loginAttempts
        delete ret.lockUntil
        delete ret.__v
        ret.id = ret._id
        delete ret._id
        return ret
      },
    },
  },
)

userSchema.methods.isLocked = function (this: IUser): boolean {
  return !!this.lockUntil && this.lockUntil > Date.now()
}

userSchema.methods.comparePassword = function (this: IUser, candidate: string) {
  // Guard against documents missing a hash (e.g. legacy/partial records) so a
  // bad row yields a clean auth failure instead of an unhandled 500 crash.
  if (!this.passwordHash) return Promise.resolve(false)
  return bcrypt.compare(candidate, this.passwordHash)
}

// Atomic counter updates avoid race conditions on rapid repeated attempts.
userSchema.statics.recordFailedLogin = async function (id: mongoose.Types.ObjectId) {
  const user = await this.findById(id)
  if (!user) return
  // If a prior lock has expired, reset the counter first.
  if (user.lockUntil && user.lockUntil < Date.now()) {
    user.loginAttempts = 1
    user.lockUntil = undefined
  } else {
    user.loginAttempts += 1
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = Date.now() + LOCK_TIME_MS
    }
  }
  await user.save()
}

userSchema.statics.resetLoginAttempts = async function (id: mongoose.Types.ObjectId) {
  await this.findByIdAndUpdate(id, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } })
}

export const User = mongoose.model<IUser, IUserModel>('User', userSchema)
export { MAX_LOGIN_ATTEMPTS, LOCK_TIME_MS }
