import type { NextFunction, Request, Response } from 'express'
import { FinancialYear } from '../models/FinancialYear.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// New Fund Receipts/Expenditures may only be recorded against the currently-
// active Financial Year — editing an existing record whose year has since
// gone inactive is still allowed (this only runs on create, via
// entityRouter's preValidateCreate hook).
export const requireActiveFinancialYear = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const { financialYearId } = req.body
    if (financialYearId) {
      const year = await FinancialYear.findById(financialYearId)
      if (!year?.isActive) {
        throw new ApiError(400, 'Records can only be created against the currently-active financial year')
      }
    }
    next()
  },
)
