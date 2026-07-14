import type { Expenditure, FundingRoute, NatureOfExpense } from '../types'

// Mirrors server/src/utils/expenseLabels.ts.
export const NATURE_LABELS: Record<NatureOfExpense, string> = {
  project_intervention: 'Project Intervention',
  administrative_overheads: 'Administrative Overheads',
  impact_assessment: 'Impact Assessment',
  capital_asset: 'Capital Asset',
  other: 'Any Other',
}

export const NATURE_OPTIONS = Object.entries(NATURE_LABELS) as [NatureOfExpense, string][]

export const ROUTE_LABELS: Record<FundingRoute, string> = {
  direct: 'Direct',
  intervention_partner: 'Through Intervention Partner',
}

export const ROUTE_OPTIONS = Object.entries(ROUTE_LABELS) as [FundingRoute, string][]

/** "Any Other" reads back as whatever the user actually typed. */
export function natureLabel(e: Pick<Expenditure, 'natureOfExpense' | 'otherNature'>): string {
  const base = NATURE_LABELS[e.natureOfExpense] ?? e.natureOfExpense
  return e.natureOfExpense === 'other' && e.otherNature?.trim()
    ? `Any Other — ${e.otherNature.trim()}`
    : base
}

/** One-line address of a capital asset, for tables and detail views. */
export function assetLocation(e: Pick<Expenditure, 'capitalAsset'>): string {
  const a = e.capitalAsset
  if (!a) return ''
  return [a.address, a.district, a.state, a.pinCode].map((x) => x?.trim()).filter(Boolean).join(', ')
}
