import type { NextFunction, Request, Response } from 'express'
import { FinancialYear } from '../models/FinancialYear.js'
import { Project } from '../models/Project.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { findCurrentFinancialYear, shiftIsoYears } from '../utils/financialYear.js'
import { projectCodeBase } from '../utils/projectCode.js'

// End date, financial year and project code are never taken from the client — all
// three are derived from the project's derivedStatus and the financial year its
// START DATE falls into (not today's date, so backdated projects compute correctly):
//   financialYearId -> the FY the start date falls into
//   endDate (ongoing) -> the end date of the FY 3 years past the start FY
//   endDate (other)   -> the end date of the start FY itself: a project that isn't
//                        Ongoing finishes inside the financial year it began in
//   projectCode       -> RURA2025 (see utils/projectCode)
export const computeProjectDerived = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const years = await FinancialYear.find()
    const startDate: string = req.body.startDate ?? ''
    const startFy = findCurrentFinancialYear(years, startDate || undefined)
    const ongoing = req.body.derivedStatus === 'ongoing'

    if (startFy) {
      req.body.endDate = ongoing ? shiftIsoYears(startFy.endDate, 3) : startFy.endDate
      req.body.financialYearId = String(startFy._id)
    } else {
      // No matching/known FY for the start date — don't leave a stale value.
      req.body.financialYearId = ''
    }

    req.body.projectCode = await resolveProjectCode(
      req.params.id,
      String(req.body.name ?? ''),
      startFy?.startDate ?? startDate,
    )

    next()
  },
)

// A project keeps the code it was issued — renaming it does NOT re-issue one, since the
// code is already printed on its expenditures, receipts and exported reports.
//
// The one exception is a change of financial year. The code IS the name-and-FY pair, so
// a code whose year no longer matches the project's FY is simply wrong — that happens
// when a project that had no start date (legacy rows fell back to the current FY) is
// finally given one. Re-issuing is safe: everything links by id, never by code.
async function resolveProjectCode(id: string | undefined, name: string, fyStart: string): Promise<string> {
  const base = projectCodeBase(name, fyStart)
  const year = base.slice(-4)

  if (id) {
    const existing = await Project.findById(id).select('projectCode').lean()
    const code = existing?.projectCode
    // Keep it unless the FY it encodes has moved. `CODE-2` suffixes are stripped first.
    if (code && code.replace(/-\d+$/, '').slice(-4) === year) return code
  }

  // base is [A-Z]{4}\d{4} — safe to interpolate into a regex unescaped.
  const clashes = await Project.find({ projectCode: new RegExp(`^${base}(-\\d+)?$`) })
    .select('projectCode')
    .lean()
  const taken = new Set(clashes.map((p) => p.projectCode))

  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
