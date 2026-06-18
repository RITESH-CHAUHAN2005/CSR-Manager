// Axios-backed implementations of the data services. Same interface as mockService,
// so pages are agnostic to which one is active (selected in dataService.ts).
import { api } from './api'
import type {
  AuditLogEntry,
  Company,
  CompanyFundPosition,
  DashboardSummary,
  Expenditure,
  FinancialYear,
  FundReceipt,
  ManagedUser,
  Project,
  YearFundFlow,
} from '../types'

function crud<T extends { id: string }>(resource: string) {
  return {
    list: () => api.get<T[]>(`/${resource}`).then((r) => r.data),
    create: (data: Omit<T, 'id'>) => api.post<T>(`/${resource}`, data).then((r) => r.data),
    update: (id: string, data: Partial<T>) =>
      api.put<T>(`/${resource}/${id}`, data).then((r) => r.data),
    remove: (id: string) => api.delete<{ id: string }>(`/${resource}/${id}`).then((r) => r.data),
  }
}

export const companyService = crud<Company>('companies')
export const financialYearService = crud<FinancialYear>('financial-years')
export const projectService = crud<Project>('projects')
export const fundReceiptService = crud<FundReceipt>('fund-receipts')
export const expenditureService = crud<Expenditure>('expenditures')

export const analyticsService = {
  dashboard: () => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
  yearWiseReport: () => api.get<YearFundFlow[]>('/reports/year-wise').then((r) => r.data),
  companyPositions: () =>
    api.get<CompanyFundPosition[]>('/reports/company-positions').then((r) => r.data),
}

export const userAdminService = {
  list: () => api.get<ManagedUser[]>('/users').then((r) => r.data),
  approve: (id: string) => api.patch<ManagedUser>(`/users/${id}/approve`).then((r) => r.data),
  reject: (id: string) => api.patch<ManagedUser>(`/users/${id}/reject`).then((r) => r.data),
  remove: (id: string) => api.delete<{ id: string }>(`/users/${id}`).then((r) => r.data),
}

export const logService = {
  list: (params?: { userEmail?: string; action?: string; entity?: string }) =>
    api.get<AuditLogEntry[]>('/logs', { params }).then((r) => r.data),
  mine: () => api.get<AuditLogEntry[]>('/logs/mine').then((r) => r.data),
}
