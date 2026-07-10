import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { FundReceipt } from '../models/FundReceipt.js'

interface BulkBody {
  receipts: Record<string, unknown>[]
}

// Records one receipt per contributing company in a single request. Every row is
// stored as an ordinary FundReceipt document, so the ledger, reports and per-record
// edit/delete behave exactly as they do for individually-entered receipts.
//
// Validation for all rows happens before the first insert (validateBody + the year
// check below), so a rejected batch writes nothing.
export const createFundReceiptsBulk = asyncHandler(async (req: Request, res: Response) => {
  const { receipts } = req.body as BulkBody

  // Same rule as single-receipt creation: new records only against the active FY.
  const yearIds = [...new Set(receipts.map((r) => String(r.financialYearId)))]
  const years = await FinancialYear.find({ _id: { $in: yearIds } })
  if (years.length !== yearIds.length || years.some((y) => !y.isActive)) {
    throw new ApiError(400, 'Records can only be created against the currently-active financial year')
  }

  const payload = receipts.map((r) => ({
    ...r,
    createdById: req.user?.id,
    createdByEmail: req.user?.email,
    createdByName: req.user?.name,
  }))
  const docs = await FundReceipt.insertMany(payload, { ordered: true })

  const total = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  res.locals.auditLabel = `${docs.length} receipt${docs.length === 1 ? '' : 's'}`
  res.locals.auditAfter = { receipts: docs.length, totalAmount: total }
  res.status(201).json(docs)
})
