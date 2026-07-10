import type { FundReceipt, Project } from '../types'

export interface ProjectContribution {
  companyId: string
  amount: number
}

// How much each company has actually put into a project — derived from its
// Fund Receipts (the money genuinely received), not a separate manually-entered
// figure on the project itself. Only 'company' receipts count (an 'other_source'
// receipt is income earned on the funds, not a fresh contribution).
export function contributionsForProject(projectId: string, receipts: FundReceipt[]): ProjectContribution[] {
  const totals = new Map<string, number>()
  receipts
    .filter((r) => r.projectId === projectId && r.receiptType === 'company' && r.companyId)
    .forEach((r) => totals.set(r.companyId!, (totals.get(r.companyId!) ?? 0) + r.amount))
  return [...totals.entries()].map(([companyId, amount]) => ({ companyId, amount }))
}

/** Total pledged across all of a project's contributing companies. */
export function committedTotal(project: Pick<Project, 'commitments'>): number {
  return (project.commitments ?? []).reduce((s, c) => s + (c.committedAmount || 0), 0)
}

/** Total actually received against a project, across every company. */
export function receivedTotal(projectId: string, receipts: FundReceipt[]): number {
  return contributionsForProject(projectId, receipts).reduce((s, c) => s + c.amount, 0)
}

export interface CommitmentStatus {
  companyId: string
  committed: number
  received: number
  /** Never negative — an over-payment shows as 0 pending, not as a negative figure. */
  pending: number
}

// Per-company reconciliation for one project: pledged vs paid vs outstanding.
// Every company on the project appears, even one that has paid nothing yet, and
// any company that has paid without being listed on the project is appended so no
// money silently disappears from the view.
export function commitmentStatusForProject(
  project: Pick<Project, 'id' | 'companyIds' | 'commitments'>,
  receipts: FundReceipt[],
): CommitmentStatus[] {
  const received = new Map(
    contributionsForProject(project.id, receipts).map((c) => [c.companyId, c.amount]),
  )
  const committed = new Map(
    (project.commitments ?? []).map((c) => [c.companyId, c.committedAmount || 0]),
  )

  const ordered = [
    ...(project.companyIds ?? []),
    ...[...received.keys()].filter((id) => !(project.companyIds ?? []).includes(id)),
  ]

  return ordered.map((companyId) => {
    const c = committed.get(companyId) ?? 0
    const r = received.get(companyId) ?? 0
    return { companyId, committed: c, received: r, pending: Math.max(0, c - r) }
  })
}
