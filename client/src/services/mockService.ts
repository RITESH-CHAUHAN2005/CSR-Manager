// In-memory data service. Phase 4 swaps these implementations for Axios calls to the
// Express API — the component-facing interface stays identical.
//
// Aggregation rules (reproduce the figures shown in the reference images):
//   - Dashboard "Total Balance" card = totalReceived - totalExpenditure  (carry-forward excluded:
//     it is internal movement already counted as received in a prior year).
//   - Company Fund Position balance    = received + carryForward - expenditure.
//   - Reports year balance             = (fundsReceived + carryForwardIn) - expenditure;
//                                        carryForwardOut = balance.

import type {
  Company,
  CompanyFundPosition,
  DashboardSummary,
  Expenditure,
  FinancialYear,
  FundReceipt,
  Project,
  YearFundFlow,
} from '../types'
import {
  companies as seedCompanies,
  expenditures as seedExpenditures,
  financialYears as seedFinancialYears,
  fundReceipts as seedFundReceipts,
  projects as seedProjects,
} from '../mocks/seedData'

// Mutable in-memory stores (deep-cloned so we never mutate the seed module).
const clone = <T,>(arr: T[]): T[] => arr.map((x) => ({ ...x }))
let companies = clone(seedCompanies)
let financialYears = clone(seedFinancialYears)
let projects = clone(seedProjects)
let fundReceipts = clone(seedFundReceipts)
let expenditures = clone(seedExpenditures)

let idCounter = 1000
const nextId = (prefix: string) => `${prefix}${idCounter++}`

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

// Simulate async API latency so the React Query wiring in Phase 4 is a drop-in swap.
const delay = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 120))

/** The "current" financial year used for the "this year" dashboard sub-values. */
function activeYear(): FinancialYear | undefined {
  return [...financialYears].reverse().find((fy) => fy.isActive) ?? financialYears.at(-1)
}

// ---------------- Companies ----------------
export const companyService = {
  list: () => delay(clone(companies)),
  create: (data: Omit<Company, 'id'>) => {
    const company = { ...data, id: nextId('c') }
    companies.push(company)
    return delay(company)
  },
  update: (id: string, data: Partial<Company>) => {
    companies = companies.map((c) => (c.id === id ? { ...c, ...data } : c))
    return delay(companies.find((c) => c.id === id)!)
  },
  remove: (id: string) => {
    companies = companies.filter((c) => c.id !== id)
    return delay({ id })
  },
}

// ---------------- Financial Years ----------------
export const financialYearService = {
  list: () => delay(clone(financialYears)),
  create: (data: Omit<FinancialYear, 'id'>) => {
    const fy = { ...data, id: nextId('fy') }
    financialYears.push(fy)
    return delay(fy)
  },
  update: (id: string, data: Partial<FinancialYear>) => {
    financialYears = financialYears.map((f) => (f.id === id ? { ...f, ...data } : f))
    return delay(financialYears.find((f) => f.id === id)!)
  },
  remove: (id: string) => {
    financialYears = financialYears.filter((f) => f.id !== id)
    return delay({ id })
  },
}

// ---------------- Projects ----------------
export const projectService = {
  list: () => delay(clone(projects)),
  create: (data: Omit<Project, 'id'>) => {
    const project = { ...data, id: nextId('p') }
    projects.push(project)
    return delay(project)
  },
  update: (id: string, data: Partial<Project>) => {
    projects = projects.map((p) => (p.id === id ? { ...p, ...data } : p))
    return delay(projects.find((p) => p.id === id)!)
  },
  remove: (id: string) => {
    projects = projects.filter((p) => p.id !== id)
    return delay({ id })
  },
}

// ---------------- Fund Receipts ----------------
export const fundReceiptService = {
  list: () => delay(clone(fundReceipts)),
  create: (data: Omit<FundReceipt, 'id'>) => {
    const receipt = { ...data, id: nextId('r') }
    fundReceipts.push(receipt)
    return delay(receipt)
  },
  update: (id: string, data: Partial<FundReceipt>) => {
    fundReceipts = fundReceipts.map((r) => (r.id === id ? { ...r, ...data } : r))
    return delay(fundReceipts.find((r) => r.id === id)!)
  },
  remove: (id: string) => {
    fundReceipts = fundReceipts.filter((r) => r.id !== id)
    return delay({ id })
  },
}

// ---------------- Expenditures ----------------
export const expenditureService = {
  list: () => delay(clone(expenditures)),
  create: (data: Omit<Expenditure, 'id'>) => {
    const exp = { ...data, id: nextId('e') }
    expenditures.push(exp)
    return delay(exp)
  },
  update: (id: string, data: Partial<Expenditure>) => {
    expenditures = expenditures.map((e) => (e.id === id ? { ...e, ...data } : e))
    return delay(expenditures.find((e) => e.id === id)!)
  },
  remove: (id: string) => {
    expenditures = expenditures.filter((e) => e.id !== id)
    return delay({ id })
  },
}

// ---------------- Aggregations ----------------
function companyPositions(): CompanyFundPosition[] {
  return companies.map((c) => {
    const received = sum(fundReceipts.filter((r) => r.companyId === c.id).map((r) => r.amount))
    const carryForward = sum(
      fundReceipts.filter((r) => r.companyId === c.id).map((r) => r.carryForward),
    )
    const expenditure = sum(expenditures.filter((e) => e.companyId === c.id).map((e) => e.amount))
    return {
      companyId: c.id,
      companyName: c.name,
      totalReceived: received,
      carryForward,
      expenditure,
      balance: received + carryForward - expenditure,
      projects: projects.filter((p) => p.companyId === c.id).length,
    }
  })
}

export const analyticsService = {
  dashboard: (): Promise<DashboardSummary> => {
    const totalReceived = sum(fundReceipts.map((r) => r.amount))
    const totalExpenditure = sum(expenditures.map((e) => e.amount))
    const cy = activeYear()
    const receivedThisYear = sum(
      fundReceipts.filter((r) => r.financialYearId === cy?.id).map((r) => r.amount),
    )
    const expenditureThisYear = sum(
      expenditures.filter((e) => e.financialYearId === cy?.id).map((e) => e.amount),
    )

    const yearWise = financialYears.map((fy) => ({
      year: fy.name.replace('FY ', ''),
      received: sum(fundReceipts.filter((r) => r.financialYearId === fy.id).map((r) => r.amount)),
      expenditure: sum(expenditures.filter((e) => e.financialYearId === fy.id).map((e) => e.amount)),
    }))

    const companyDistribution = companies
      .map((c) => {
        const received = sum(fundReceipts.filter((r) => r.companyId === c.id).map((r) => r.amount))
        return {
          companyName: c.name,
          received,
          percent: totalReceived ? Math.round((received / totalReceived) * 100) : 0,
        }
      })
      .filter((d) => d.received > 0)

    const completedProjects = projects.filter((p) => p.status === 'completed').length
    const activeProjects = projects.filter((p) => p.status === 'active').length

    return delay({
      totalBalance: totalReceived - totalExpenditure,
      totalReceived,
      totalExpenditure,
      balanceThisYear: receivedThisYear - expenditureThisYear,
      receivedThisYear,
      expenditureThisYear,
      activeProjects,
      completedProjects,
      totalProjects: projects.length,
      yearWise,
      companyDistribution,
      companyPositions: companyPositions(),
    })
  },

  yearWiseReport: (): Promise<YearFundFlow[]> => {
    const rows = financialYears.map((fy) => {
      const fundsReceived = sum(
        fundReceipts.filter((r) => r.financialYearId === fy.id).map((r) => r.amount),
      )
      const carryForwardIn = sum(
        fundReceipts.filter((r) => r.financialYearId === fy.id).map((r) => r.carryForward),
      )
      const expenditure = sum(
        expenditures.filter((e) => e.financialYearId === fy.id).map((e) => e.amount),
      )
      const totalAvailable = fundsReceived + carryForwardIn
      const balance = totalAvailable - expenditure
      return {
        financialYearId: fy.id,
        yearName: fy.name,
        fundsReceived,
        carryForwardIn,
        totalAvailable,
        expenditure,
        balance,
        carryForwardOut: balance,
      }
    })
    return delay(rows)
  },

  companyPositions: () => delay(companyPositions()),

  // Server-rendered PDF/Excel isn't available in standalone mock mode; callers fall back.
  exportReport: (_type: 'year' | 'company' | 'project', _format: 'pdf' | 'excel'): Promise<Blob> =>
    Promise.reject(new Error('Server export unavailable in offline mode')),
}

// --- Mock stubs for admin users + logs (only meaningful with the live API) ---
import type { AuditLogEntry, ManagedUser, NewUserInput } from '../types'

export const userAdminService = {
  list: (): Promise<ManagedUser[]> => delay([]),
  create: (data: NewUserInput) =>
    delay({ id: nextId('u'), createdAt: '', ...data } as unknown as ManagedUser),
  remove: (id: string) => delay({ id }),
}

export const logService = {
  list: (_params?: { userEmail?: string; action?: string; entity?: string }): Promise<AuditLogEntry[]> => delay([]),
  mine: (): Promise<AuditLogEntry[]> => delay([]),
  clear: (): Promise<{ deleted: number }> => delay({ deleted: 0 }),
}
