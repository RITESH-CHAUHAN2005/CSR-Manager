import type { FundingRoute, NatureOfExpense } from '../models/Expenditure.js'

// Display names for the stored expenditure enums. Mirrored on the client in
// client/src/lib/expenseLabels.ts.
export const NATURE_LABELS: Record<NatureOfExpense, string> = {
  project_intervention: 'Project Intervention',
  administrative_overheads: 'Administrative Overheads',
  impact_assessment: 'Impact Assessment',
  capital_asset: 'Capital Asset',
  other: 'Any Other',
}

export const ROUTE_LABELS: Record<FundingRoute, string> = {
  direct: 'Direct',
  intervention_partner: 'Through Intervention Partner',
}

/** "Any Other" reads as the thing the user actually typed. */
export function natureLabel(nature: string, otherNature?: string): string {
  const base = NATURE_LABELS[nature as NatureOfExpense] ?? nature
  return nature === 'other' && otherNature?.trim() ? `Any Other — ${otherNature.trim()}` : base
}
