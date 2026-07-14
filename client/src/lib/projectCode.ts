import type { FinancialYear } from '../types'
import { findCurrentFinancialYear } from './financialYear'

// Mirrors server/src/utils/projectCode.ts — a project's business key is the first 4
// letters of its name + the start year of the financial year it began in.
// "Rural Education Drive" starting in FY 2025-26 -> RURA2025.
export function projectCodeBase(name: string, fyStartDate: string): string {
  const letters = (name ?? '').replace(/[^A-Za-z]/g, '').toUpperCase()
  const slug = (letters || 'PROJ').slice(0, 4).padEnd(4, 'X')
  const year = /^\d{4}/.test(fyStartDate ?? '')
    ? fyStartDate.slice(0, 4)
    : String(new Date().getFullYear())
  return `${slug}${year}`
}

// What the server will issue for a project being added. Purely a preview for the form —
// the real code (including any -2 suffix, if another project already holds this one) is
// assigned server-side on save.
export function previewProjectCode(
  years: FinancialYear[],
  name: string,
  startDate: string,
): string {
  if (!name.trim() || !startDate) return ''
  const startFy = findCurrentFinancialYear(years, startDate || undefined)
  return projectCodeBase(name, startFy?.startDate ?? startDate)
}
