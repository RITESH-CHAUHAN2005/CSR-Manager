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
  ExpenditureDocumentMeta,
  FundReceiptDocumentMeta,
  FinancialYear,
  FundReceipt,
  MasterDataItem,
  Project,
  ProjectDocumentMeta,
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

let masterDataItems: MasterDataItem[] = [
  { id: 'md1', type: 'category', value: 'Education' },
  { id: 'md2', type: 'category', value: 'Environment' },
  { id: 'md3', type: 'category', value: 'Skill Development' },
  { id: 'md4', type: 'category', value: 'Healthcare' },
  { id: 'md5', type: 'status', value: 'Active' },
  { id: 'md6', type: 'status', value: 'Not Active' },
  { id: 'md7', type: 'source', value: 'Interest' },
  { id: 'md8', type: 'source', value: 'SIP' },
  { id: 'md9', type: 'source', value: 'FD' },
  { id: 'md10', type: 'category', value: 'Infrastructure' },
  { id: 'md11', type: 'category', value: 'Women Empowerment' },
  { id: 'md12', type: 'category', value: 'Rural Development' },
  { id: 'md13', type: 'source', value: 'Bank Deposit' },
]

// Documents are held only for the current session (object URLs), since there's no
// real backend in mock mode.
let projectDocuments: (ProjectDocumentMeta & { url: string })[] = []

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
    // Mirror the backend rule: an active project cannot be deleted.
    const target = projects.find((p) => p.id === id)
    if (target?.status === 'active') {
      return Promise.reject(
        new Error('This project is Active and cannot be deleted. Mark it as Completed first, then delete it.'),
      )
    }
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
  // Mirrors the backend's POST /fund-receipts/bulk — one ordinary receipt per row.
  createMany: (data: Omit<FundReceipt, 'id'>[]) => {
    const created = data.map((d) => ({ ...d, id: nextId('r') }))
    fundReceipts.push(...created)
    return delay(created)
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
    const myProjects = projects.filter((p) => p.companyIds?.includes(c.id))
    const myExpenditures = expenditures.filter((e) => e.companyId === c.id)
    const carryForward =
      sum(fundReceipts.filter((r) => r.companyId === c.id).map((r) => r.carryForward ?? 0)) +
      sum(myExpenditures.map((e) => e.carryForwardAmount ?? 0))
    const expenditure = sum(myExpenditures.map((e) => e.amount))
    return {
      companyId: c.id,
      companyName: c.name,
      totalReceived: received,
      carryForward,
      expenditure,
      balance: received + carryForward - expenditure,
      projects: myProjects.length,
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
        fundReceipts.filter((r) => r.financialYearId === fy.id).map((r) => r.carryForward ?? 0),
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
  exportReport: (
    _type: 'year' | 'company' | 'project' | 'carryForward' | 'ledger',
    _format: 'pdf' | 'excel',
  ): Promise<Blob> =>
    Promise.reject(new Error('Server export unavailable in offline mode')),
}

// ---------------- Master Data (Category / Status / Source) ----------------
export const masterDataService = {
  list: () => delay(clone(masterDataItems)),
  create: (data: Omit<MasterDataItem, 'id'>) => {
    const item = { ...data, id: nextId('md') }
    masterDataItems.push(item)
    return delay(item)
  },
  update: (id: string, data: Partial<MasterDataItem>) => {
    masterDataItems = masterDataItems.map((m) => (m.id === id ? { ...m, ...data } : m))
    return delay(masterDataItems.find((m) => m.id === id)!)
  },
  remove: (id: string) => {
    masterDataItems = masterDataItems.filter((m) => m.id !== id)
    return delay({ id })
  },
}

// ---------------- Project documents (session-only, no real backend) ----------------
export const projectDocumentService = {
  list: (projectId: string): Promise<ProjectDocumentMeta[]> =>
    delay(projectDocuments.filter((d) => d.projectId === projectId).map(({ url: _url, ...meta }) => meta)),
  upload: (projectId: string, file: File): Promise<ProjectDocumentMeta> => {
    const meta = {
      id: nextId('doc'),
      projectId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      url: URL.createObjectURL(file),
    }
    projectDocuments.push(meta)
    const { url: _url, ...rest } = meta
    return delay(rest)
  },
  remove: (projectId: string, docId: string) => {
    projectDocuments = projectDocuments.filter((d) => !(d.projectId === projectId && d.id === docId))
    return delay({ id: docId })
  },
  downloadUrl: (_projectId: string, docId: string) =>
    projectDocuments.find((d) => d.id === docId)?.url ?? '#',
}

// ---------------- Fund receipt documents (session-only, no real backend) ----------------
let fundReceiptDocuments: (FundReceiptDocumentMeta & { url: string })[] = []

export const fundReceiptDocumentService = {
  list: (fundReceiptId: string): Promise<FundReceiptDocumentMeta[]> =>
    delay(
      fundReceiptDocuments
        .filter((d) => d.fundReceiptId === fundReceiptId)
        .map(({ url: _url, ...meta }) => meta),
    ),
  upload: (fundReceiptId: string, file: File): Promise<FundReceiptDocumentMeta> => {
    const meta = {
      id: nextId('doc'),
      fundReceiptId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      url: URL.createObjectURL(file),
    }
    fundReceiptDocuments.push(meta)
    const { url: _url, ...rest } = meta
    return delay(rest)
  },
  remove: (fundReceiptId: string, docId: string) => {
    fundReceiptDocuments = fundReceiptDocuments.filter(
      (d) => !(d.fundReceiptId === fundReceiptId && d.id === docId),
    )
    return delay({ id: docId })
  },
  downloadUrl: (_fundReceiptId: string, docId: string) =>
    fundReceiptDocuments.find((d) => d.id === docId)?.url ?? '#',
}

// ---------------- Expenditure documents (session-only, no real backend) ----------------
let expenditureDocuments: (ExpenditureDocumentMeta & { url: string })[] = []

export const expenditureDocumentService = {
  list: (expenditureId: string): Promise<ExpenditureDocumentMeta[]> =>
    delay(
      expenditureDocuments
        .filter((d) => d.expenditureId === expenditureId)
        .map(({ url: _url, ...meta }) => meta),
    ),
  upload: (expenditureId: string, file: File): Promise<ExpenditureDocumentMeta> => {
    const meta = {
      id: nextId('doc'),
      expenditureId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      url: URL.createObjectURL(file),
    }
    expenditureDocuments.push(meta)
    const { url: _url, ...rest } = meta
    return delay(rest)
  },
  remove: (expenditureId: string, docId: string) => {
    expenditureDocuments = expenditureDocuments.filter(
      (d) => !(d.expenditureId === expenditureId && d.id === docId),
    )
    return delay({ id: docId })
  },
  downloadUrl: (_expenditureId: string, docId: string) =>
    expenditureDocuments.find((d) => d.id === docId)?.url ?? '#',
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
