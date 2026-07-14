// Carry forward is DERIVED, never typed in.
//
// Per Ongoing project: the money that arrived against it (Fund Receipts linked to that
// project) minus what has been spent on it. Whatever is left is what rolls into the
// next financial year. It is split per company so each donor sees its own unspent
// balance, which is exact — receipts and expenditures both name a company, so nothing
// has to be apportioned pro-rata.
//
// The client mirrors this in client/src/lib/carryForward.ts — keep the two in step.

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const oid = (v: unknown) => (v == null ? '' : String(v))

export interface CarryForwardRow {
  projectId: string
  projectCode: string
  projectName: string
  companyId: string
  companyName: string
  received: number
  spent: number
  carryForward: number
}

interface CarryForwardInput {
  projects: {
    _id: unknown
    name: string
    projectCode?: string
    derivedStatus: string
    companyIds: unknown[]
  }[]
  companies: { _id: unknown; name: string }[]
  receipts: { projectId?: unknown; companyId?: unknown; amount: number }[]
  expenditures: { projectId: unknown; companyId: unknown; amount: number }[]
}

export function carryForwardRows(d: CarryForwardInput): CarryForwardRow[] {
  const rows: CarryForwardRow[] = []

  for (const p of d.projects.filter((x) => x.derivedStatus === 'ongoing')) {
    const pid = oid(p._id)
    const forProject = <T extends { projectId?: unknown }>(xs: T[]) =>
      xs.filter((x) => oid(x.projectId) === pid)
    const projectReceipts = forProject(d.receipts)
    const projectSpends = forProject(d.expenditures)

    // Every company linked to the project, plus any that actually put money in or
    // spent against it — so a company that isn't on the project's list still shows up
    // rather than being silently dropped from the totals.
    const companyIds = new Set(p.companyIds.map(oid))
    projectReceipts.forEach((r) => r.companyId && companyIds.add(oid(r.companyId)))
    projectSpends.forEach((e) => companyIds.add(oid(e.companyId)))

    for (const cid of companyIds) {
      const received = sum(projectReceipts.filter((r) => oid(r.companyId) === cid).map((r) => r.amount))
      const spent = sum(projectSpends.filter((e) => oid(e.companyId) === cid).map((e) => e.amount))
      if (received === 0 && spent === 0) continue
      rows.push({
        projectId: pid,
        projectCode: p.projectCode ?? '',
        projectName: p.name,
        companyId: cid,
        companyName: d.companies.find((c) => oid(c._id) === cid)?.name ?? '—',
        received,
        spent,
        // An over-spent project carries nothing forward. The shortfall is still
        // visible on the row as spent > received.
        carryForward: Math.max(0, received - spent),
      })
    }
  }

  return rows
}

/** Unspent money each company still holds on Ongoing projects, keyed by company id. */
export function carryForwardByCompany(rows: CarryForwardRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.companyId, (totals.get(r.companyId) ?? 0) + r.carryForward)
  return totals
}

export interface YearFlowRow {
  financialYearId: string
  yearName: string
  fundsReceived: number
  carryForwardIn: number
  totalAvailable: number
  expenditure: number
  balance: number
  carryForwardOut: number
}

// Year-wise fund flow. Carry Forward In is whatever was left unspent at the end of the
// previous year, so the years chain and the final year's Carry Forward Out is the money
// genuinely still in hand. `years` must be in chronological order.
export function yearFundFlow(d: {
  years: { _id: unknown; name: string }[]
  receipts: { financialYearId: unknown; amount: number }[]
  expenditures: { financialYearId: unknown; amount: number }[]
}): YearFlowRow[] {
  let carryForwardIn = 0
  return d.years.map((y) => {
    const yid = oid(y._id)
    const fundsReceived = sum(d.receipts.filter((r) => oid(r.financialYearId) === yid).map((r) => r.amount))
    const expenditure = sum(d.expenditures.filter((e) => oid(e.financialYearId) === yid).map((e) => e.amount))
    const totalAvailable = carryForwardIn + fundsReceived
    const balance = totalAvailable - expenditure
    const row: YearFlowRow = {
      financialYearId: yid,
      yearName: y.name,
      fundsReceived,
      carryForwardIn,
      totalAvailable,
      expenditure,
      balance,
      carryForwardOut: balance,
    }
    carryForwardIn = balance
    return row
  })
}
