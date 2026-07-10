import type { NextFunction, Request, Response } from 'express'

// `commitments` is the single source of truth for "which companies fund this project
// and how much did each pledge". `companyIds` is never trusted from the client — it is
// always re-derived here so the two can't drift apart. Older clients (and the smoke
// test) that still send only `companyIds` get commitments of 0 back-filled for them.
export function normalizeProjectCommitments(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as {
    commitments?: unknown
    companyIds?: unknown
  }

  if (Array.isArray(body.commitments)) {
    // Last entry wins on a duplicated company, so a malformed payload can never
    // produce two rows for the same donor.
    const byCompany = new Map<string, { companyId: string; committedAmount: number }>()
    for (const entry of body.commitments) {
      const c = entry as { companyId?: unknown; committedAmount?: unknown }
      const companyId = String(c?.companyId ?? '').trim()
      if (!companyId) continue
      const amount = Number(c?.committedAmount)
      byCompany.set(companyId, {
        companyId,
        committedAmount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      })
    }
    body.commitments = [...byCompany.values()]
    body.companyIds = [...byCompany.keys()]
  } else if (Array.isArray(body.companyIds)) {
    const ids = [...new Set(body.companyIds.map((id) => String(id).trim()).filter(Boolean))]
    body.companyIds = ids
    body.commitments = ids.map((companyId) => ({ companyId, committedAmount: 0 }))
  }

  next()
}
