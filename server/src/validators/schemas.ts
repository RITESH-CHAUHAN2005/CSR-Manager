import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD date')
const money = z.coerce.number().min(0)

// Login no longer takes a role — the role is whatever the account has in the DB.
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Admin creates admin/editor/viewer accounts (no self-registration). Password policy
// enforced here (production requirement). An admin may now create additional admins.
export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  role: z.enum(['admin', 'editor', 'viewer']),
  companyId: objectId.optional(),
})

export const companySchema = z.object({
  name: z.string().min(1).max(200),
  cin: z.string().min(1).max(50),
  contactPerson: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(1).max(40),
})

export const financialYearSchema = z.object({
  name: z.string().min(1).max(50),
  startDate: isoDate,
  endDate: isoDate,
  isActive: z.boolean().optional().default(false),
})

export const projectSchema = z.object({
  name: z.string().min(1).max(200),
  companyId: objectId,
  financialYearId: objectId,
  category: z.string().min(1).max(80),
  location: z.string().min(1).max(160),
  budget: money,
  status: z.enum(['active', 'completed']).default('active'),
  description: z.string().max(2000).optional().default(''),
})

export const fundReceiptSchema = z.object({
  date: isoDate,
  companyId: objectId,
  financialYearId: objectId,
  reference: z.string().min(1).max(120),
  mode: z.enum(['NEFT', 'RTGS', 'Cheque']),
  carryForward: money.optional().default(0),
  amount: money,
})

export const expenditureSchema = z.object({
  date: isoDate,
  projectId: objectId,
  companyId: objectId,
  financialYearId: objectId,
  category: z.string().min(1).max(80),
  approvedBy: z.string().min(1).max(120),
  amount: money,
})
