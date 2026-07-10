import type { FundReceipt } from '../types'

export interface ProjectContribution {
  companyId: string
  amount: number
}

// How much each company has actually put into a project — derived from its
// Fund Receipts (the money genuinely received), not a separate manually-entered
// figure on the project itself. Only 'company' receipts count (an 'other_source'
// receipt isn't attributable to any donor company).
export function contributionsForProject(projectId: string, receipts: FundReceipt[]): ProjectContribution[] {
  const totals = new Map<string, number>()
  receipts
    .filter((r) => r.projectId === projectId && r.receiptType === 'company' && r.companyId)
    .forEach((r) => totals.set(r.companyId!, (totals.get(r.companyId!) ?? 0) + r.amount))
  return [...totals.entries()].map(([companyId, amount]) => ({ companyId, amount }))
}
