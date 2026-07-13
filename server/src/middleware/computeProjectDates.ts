import type { NextFunction, Request, Response } from 'express'
import { FinancialYear } from '../models/FinancialYear.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { findCurrentFinancialYear, shiftIsoYears } from '../utils/financialYear.js'

// The end date and financial year are never taken from the client — both are
// derived from the project's derivedStatus and the financial year the project's
// START DATE falls into (not today's date, so backdated projects compute correctly):
//   financialYearId -> the FY the start date falls into
//   endDate (ongoing) -> the end date of the FY 3 years past the start FY
//   endDate (other)   -> the end date of the FY 1 year past the start FY
export const computeProjectDates = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const years = await FinancialYear.find()
    const startFy = findCurrentFinancialYear(years, req.body.startDate)
    const ongoing = req.body.derivedStatus === 'ongoing'

    if (startFy) {
      req.body.endDate = shiftIsoYears(startFy.endDate, ongoing ? 3 : 1)
      req.body.financialYearId = String(startFy._id)
    } else {
      // No matching/known FY for the start date — don't leave a stale value.
      req.body.financialYearId = ''
    }

    next()
  },
)
