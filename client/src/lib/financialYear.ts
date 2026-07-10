import type { FinancialYear } from '../types'

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// The FY whose start/end range brackets today. Falls back to the year flagged
// isActive, then the most recent year by end date, when no range matches.
export function findCurrentFinancialYear(
  years: FinancialYear[],
  today: string = todayIso(),
): FinancialYear | undefined {
  const inRange = years.find((y) => y.startDate <= today && today <= y.endDate)
  if (inRange) return inRange
  const active = years.find((y) => y.isActive)
  if (active) return active
  return [...years].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
}

// Shift an ISO yyyy-mm-dd date by N years, keeping month/day.
export function shiftIsoYears(iso: string, deltaYears: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const shifted = new Date(Date.UTC(y + deltaYears, m - 1, d))
  return shifted.toISOString().slice(0, 10)
}

// Preview of the project End Date the server will compute, given the FY the
// chosen Start Date falls into (not today) and the Derived Status. Purely for
// display in the Add/Edit form.
export function previewProjectEndDate(
  years: FinancialYear[],
  derivedStatus: 'ongoing' | 'other',
  startDate: string,
): string {
  const startFy = findCurrentFinancialYear(years, startDate || undefined)
  if (!startFy) return ''
  return shiftIsoYears(startFy.endDate, derivedStatus === 'ongoing' ? 3 : 1)
}
