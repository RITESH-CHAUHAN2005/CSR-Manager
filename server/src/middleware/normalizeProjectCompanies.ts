import type { NextFunction, Request, Response } from 'express'

// `companyIds` is never trusted verbatim from the client: blanks are dropped and
// duplicates collapsed, so a malformed payload can't list the same donor twice.
export function normalizeProjectCompanies(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as { companyIds?: unknown }
  if (Array.isArray(body.companyIds)) {
    body.companyIds = [...new Set(body.companyIds.map((id) => String(id).trim()).filter(Boolean))]
  }
  next()
}
