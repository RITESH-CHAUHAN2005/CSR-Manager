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

// Only the company name is required. Remaining donor-profile fields are optional
// (email, when supplied, must still be a valid address).
export const companySchema = z.object({
  name: z.string().min(1).max(200),
  cin: z.string().max(50).optional().default(''),
  contactPerson: z.string().max(120).optional().default(''),
  email: z.union([z.string().email(), z.literal('')]).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  address: z.string().max(400).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
})

export const financialYearSchema = z.object({
  name: z.string().min(1).max(50),
  startDate: isoDate,
  endDate: isoDate,
  isActive: z.boolean().optional().default(false),
})

export const projectSchema = z
  .object({
    name: z.string().min(1).max(200),
    companyId: objectId,
    financialYearId: objectId,
    category: z.string().max(80).optional().default(''),
    location: z.string().max(160).optional().default(''),
    budget: money.optional().default(0),
    status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
    ongoing: z.coerce.boolean().optional().default(false),
    description: z.string().max(2000).optional().default(''),
    // Start date is mandatory; end date stays optional (blank when a project is ongoing).
    startDate: z.string().min(1, 'Start date is required').max(20),
    endDate: z.string().max(20).optional().default(''),
    notes: z.string().max(2000).optional().default(''),
  })
  // For clarity, an On Hold or Cancelled project must carry a reason in either the
  // description or the notes so reviewers know why it was paused/stopped.
  .refine(
    (d) =>
      !['on_hold', 'cancelled'].includes(d.status) ||
      Boolean(d.description?.trim()) ||
      Boolean(d.notes?.trim()),
    {
      message: 'Add a description or notes explaining why the project is On Hold or Cancelled.',
      path: ['description'],
    },
  )

export const fundReceiptSchema = z.object({
  date: isoDate,
  companyId: objectId,
  financialYearId: objectId,
  reference: z.string().max(120).optional().default(''),
  mode: z.enum(['NEFT', 'RTGS', 'Cheque']),
  carryForward: money.optional().default(0),
  amount: money,
  notes: z.string().max(2000).optional().default(''),
})

export const expenditureSchema = z.object({
  date: isoDate,
  projectId: objectId,
  companyId: objectId,
  financialYearId: objectId,
  category: z.string().max(80).optional().default(''),
  approvedBy: z.string().max(120).optional().default(''),
  amount: money,
  description: z.string().max(2000).optional().default(''),
  reference: z.string().max(120).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
})
