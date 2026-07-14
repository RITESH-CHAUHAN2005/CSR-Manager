import type {
  CarryForwardRow,
  Company,
  Expenditure,
  FinancialYear,
  FundReceipt,
  Project,
  YearFundFlow,
} from '../types'

// Carry forward is DERIVED, never typed in. Mirrors server/src/utils/carryForward.ts —
// keep the two in step.
//
// Per Ongoing project: the money that arrived against it (Fund Receipts linked to that
// project) minus what has been spent on it. Whatever is left rolls into the next
// financial year. Split per company, which is exact rather than pro-rata: receipts and
// expenditures both name a company.

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export function carryForwardRows(d: {
  projects: Project[]
  companies: Company[]
  receipts: FundReceipt[]
  expenditures: Expenditure[]
}): CarryForwardRow[] {
  const rows: CarryForwardRow[] = []

  for (const p of d.projects.filter((x) => x.derivedStatus === 'ongoing')) {
    const projectReceipts = d.receipts.filter((r) => r.projectId === p.id)
    const projectSpends = d.expenditures.filter((e) => e.projectId === p.id)

    // Every company linked to the project, plus any that actually put money in or spent
    // against it — so nobody is silently dropped from the totals.
    const companyIds = new Set(p.companyIds ?? [])
    projectReceipts.forEach((r) => r.companyId && companyIds.add(r.companyId))
    projectSpends.forEach((e) => companyIds.add(e.companyId))

    for (const cid of companyIds) {
      const received = sum(projectReceipts.filter((r) => r.companyId === cid).map((r) => r.amount))
      const spent = sum(projectSpends.filter((e) => e.companyId === cid).map((e) => e.amount))
      if (received === 0 && spent === 0) continue
      rows.push({
        projectId: p.id,
        projectCode: p.projectCode ?? '',
        projectName: p.name,
        companyId: cid,
        companyName: d.companies.find((c) => c.id === cid)?.name ?? '—',
        received,
        spent,
        // An over-spent project carries nothing forward; the shortfall stays visible on
        // the row as spent > received.
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

// Year-wise fund flow. Carry Forward In is whatever was left unspent at the end of the
// previous year, so the years chain and the final year's Carry Forward Out is the money
// genuinely still in hand. `years` must be in chronological order.
export function yearFundFlow(d: {
  years: FinancialYear[]
  receipts: FundReceipt[]
  expenditures: Expenditure[]
}): YearFundFlow[] {
  let carryForwardIn = 0
  return [...d.years]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((y) => {
      const fundsReceived = sum(d.receipts.filter((r) => r.financialYearId === y.id).map((r) => r.amount))
      const expenditure = sum(d.expenditures.filter((e) => e.financialYearId === y.id).map((e) => e.amount))
      const totalAvailable = carryForwardIn + fundsReceived
      const balance = totalAvailable - expenditure
      const row: YearFundFlow = {
        financialYearId: y.id,
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

/** The financial year an Ongoing project's unspent money rolls into. */
export function rollsIntoYear(years: FinancialYear[], currentFy?: FinancialYear): string {
  if (!currentFy) return '—'
  const upcoming = years
    .filter((y) => y.startDate > currentFy.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return upcoming[0]?.name ?? '—'
}
