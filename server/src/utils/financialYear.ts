import type { IFinancialYear } from '../models/FinancialYear.js'

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// The FY whose start/end range brackets today. Falls back to the year flagged
// isActive, then the most recent year by end date, when no range matches (e.g. a
// gap year hasn't been created yet).
export function findCurrentFinancialYear<T extends Pick<IFinancialYear, 'startDate' | 'endDate' | 'isActive'>>(
  years: T[],
  today: string = todayIso(),
): T | undefined {
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
