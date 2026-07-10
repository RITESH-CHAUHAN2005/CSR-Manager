import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD date')
const money = z.coerce.number().min(0)

// Site-wide rule: Start Date and Receipt Date can never be in the future.
const notFutureDate = (label: string, maxLen = 20) =>
  z
    .string()
    .max(maxLen)
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD date')
    .refine((d) => d.slice(0, 10) <= new Date().toISOString().slice(0, 10), {
      message: `${label} cannot be a future date`,
    })

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
    companyIds: z.array(objectId).min(1, 'Select at least one company'),
    category: z.string().max(80).optional().default(''),
    location: z.string().max(160).optional().default(''),
    // The approved cost of the project.
    budget: money.optional().default(0),
    status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
    // Ongoing = end date auto-extends 4 years past the current FY; Other = end date
    // is fixed to the current FY's end date. The end date itself is computed by
    // middleware, not taken from the client. Carry-forward for an Ongoing project is
    // recorded per-expenditure, not here.
    derivedStatus: z.enum(['ongoing', 'other']).default('other'),
    description: z.string().max(2000).optional().default(''),
    // Start date is mandatory and can never be in the future.
    startDate: notFutureDate('Start date'),
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

export const fundReceiptSchema = z
  .object({
    date: notFutureDate('Receipt date'),
    // 'company' = a donor company's direct contribution; 'other_source' = income
    // earned on a company's funds via a Master Data Source (Interest/SIP/FD…).
    // Either way the money belongs to a company, so companyId is required for both.
    receiptType: z.enum(['company', 'other_source']).default('company'),
    companyId: z.union([objectId, z.literal('')]).optional().default(''),
    source: z.string().max(80).optional().default(''),
    financialYearId: objectId,
    // Optional link to the project this receipt funds. Empty string -> undefined so
    // Mongoose doesn't try to cast '' to an ObjectId.
    projectId: z
      .union([objectId, z.literal('')])
      .optional()
      .default('')
      .transform((v) => v || undefined),
    // "Account Number" in the UI.
    reference: z.string().max(120).optional().default(''),
    // No longer collected on the form; kept optional so historical records still validate.
    mode: z.enum(['NEFT', 'RTGS', 'Cheque', '']).optional().default(''),
    carryForward: money.optional().default(0),
    amount: money,
    notes: z.string().max(2000).optional().default(''),
  })
  .transform((d) => ({ ...d, companyId: d.companyId || undefined }))
  .refine((d) => Boolean(d.companyId), {
    message: 'Company is required',
    path: ['companyId'],
  })
  .refine((d) => d.receiptType !== 'other_source' || Boolean(d.source?.trim()), {
    message: 'Source is required for a receipt from another source',
    path: ['source'],
  })

// Bulk entry: one shared date / financial year, one receipt row per contributing
// company of the selected project, each with its own account number and amount. Each
// row is a full, independently validated FundReceipt — the records stored are
// identical to those a one-at-a-time entry would produce, so nothing about the audit
// trail or reporting changes.
export const fundReceiptBulkSchema = z.object({
  receipts: z.array(fundReceiptSchema).min(1, 'Enter an amount for at least one company').max(50),
})

export const masterDataItemSchema = z.object({
  type: z.enum(['category', 'status', 'source']),
  value: z.string().min(1).max(80),
})

export const expenditureSchema = z.object({
  date: isoDate,
  projectId: objectId,
  companyId: objectId,
  financialYearId: objectId,
  category: z.string().max(80).optional().default(''),
  approvedBy: z.string().max(120).optional().default(''),
  amount: money,
  // Only meaningful when the linked project is Ongoing — recorded here rather
  // than on the project itself.
  carryForwardAmount: money.optional().default(0),
  description: z.string().max(2000).optional().default(''),
  reference: z.string().max(120).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
})
