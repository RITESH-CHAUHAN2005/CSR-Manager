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
// (email and PAN, when supplied, must still be well-formed).
export const companySchema = z.object({
  name: z.string().min(1).max(200),
  cin: z.string().max(50).optional().default(''),
  // Indian PAN: 5 letters, 4 digits, 1 letter (e.g. AAACT2727Q). Blank is allowed —
  // it's optional donor profile data — but a typo'd PAN is not.
  pan: z
    .string()
    .max(10)
    .optional()
    .default('')
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => v === '' || /^[A-Z]{5}\d{4}[A-Z]$/.test(v), {
      message: 'PAN must be 10 characters, e.g. AAACT2727Q',
    }),
  contactPerson: z.string().max(120).optional().default(''),
  email: z.union([z.string().email(), z.literal('')]).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  address: z.string().max(400).optional().default(''),
  description: z.string().max(2000).optional().default(''),
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
    // Like endDate/financialYearId, issued by middleware (assignProjectCode) — never
    // trusted from the client, so a caller can't mint or hijack another project's code.
    projectCode: z.string().max(40).optional().default(''),
    companyIds: z.array(objectId).min(1, 'Select at least one company'),
    category: z.string().max(80).optional().default(''),
    location: z.string().max(160).optional().default(''),
    // The implementing agency delivering the project, when it isn't run directly.
    interventionPartner: z.string().max(200).optional().default(''),
    // The approved cost of the project.
    budget: money.optional().default(0),
    status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
    // Ongoing = end date auto-extends 3 years past the start FY; Other than Ongoing
    // ends inside the start FY (that FY's end date). The end date itself is computed
    // by middleware, not taken from the client. Carry-forward for an Ongoing project
    // is derived from receipts minus expenditure, never stored.
    derivedStatus: z.enum(['ongoing', 'other']).default('other'),
    description: z.string().max(2000).optional().default(''),
    // Start date is mandatory and can never be in the future.
    startDate: notFutureDate('Start date'),
    endDate: z.string().max(20).optional().default(''),
    // Like endDate, computed by middleware from the start-date FY — not the client.
    // Empty string (no matching FY) -> undefined so Mongoose doesn't cast '' to an ObjectId.
    financialYearId: z
      .union([objectId, z.literal('')])
      .optional()
      .default('')
      .transform((v) => v || undefined),
  })
  // For clarity, an On Hold or Cancelled project must carry a reason in its description
  // so reviewers know why it was paused/stopped.
  .refine(
    (d) => !['on_hold', 'cancelled'].includes(d.status) || Boolean(d.description?.trim()),
    {
      message: 'Add a description explaining why the project is On Hold or Cancelled.',
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
    description: z.string().max(2000).optional().default(''),
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
  description: z.string().max(2000).optional().default(''),
})

// The F.Expense record: which project (by Project ID), whose money, how much, and when.
// Carry-forward is NOT recorded here — it is derived from funds received against a
// project minus what has been spent on it.
export const expenditureSchema = z.object({
  // Money can't be spent in the future. Same site-wide rule as a project's start date
  // and a receipt's date.
  date: notFutureDate('Date of spend'),
  projectId: objectId,
  companyId: objectId,
  financialYearId: objectId,
  approvedBy: z.string().max(120).optional().default(''),
  amount: money,
  description: z.string().max(2000).optional().default(''),
  reference: z.string().max(120).optional().default(''),
})
