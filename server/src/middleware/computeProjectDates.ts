import type { NextFunction, Request, Response } from 'express'
import { FinancialYear } from '../models/FinancialYear.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { findCurrentFinancialYear, shiftIsoYears } from '../utils/financialYear.js'

// The end date is never taken from the client — it is always derived from the
// project's derivedStatus and the financial year the project's START DATE
// falls into (not today's date, so backdated projects compute correctly):
//   ongoing -> end date is the end date of the FY 3 years past the start FY
//   other   -> end date is the end date of the FY 1 year past the start FY
export const computeProjectDates = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const years = await FinancialYear.find()
    const startFy = findCurrentFinancialYear(years, req.body.startDate)
    const ongoing = req.body.derivedStatus === 'ongoing'

    if (startFy) {
      req.body.endDate = shiftIsoYears(startFy.endDate, ongoing ? 3 : 1)
    }

    next()
  },
)
