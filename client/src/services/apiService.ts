// Axios-backed implementations of the data services. Same interface as mockService,
// so pages are agnostic to which one is active (selected in dataService.ts).
import { api } from './api'
import type {
  AuditLogEntry,
  Company,
  CompanyFundPosition,
  DashboardSummary,
  Expenditure,
  ExpenditureDocumentMeta,
  FinancialYear,
  FundReceipt,
  FundReceiptDocumentMeta,
  ExportType,
  ManagedUser,
  MasterDataItem,
  NewUserInput,
  Project,
  ProjectDocumentMeta,
  SupportRequest,
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
export const fundReceiptService = {
  ...crud<FundReceipt>('fund-receipts'),
  // Records one receipt per contributing company in a single request. The server
  // validates every row before writing any, so a rejected batch stores nothing.
  createMany: (receipts: Omit<FundReceipt, 'id'>[]) =>
    api.post<FundReceipt[]>('/fund-receipts/bulk', { receipts }).then((r) => r.data),
}
export const expenditureService = crud<Expenditure>('expenditures')
export const masterDataService = crud<MasterDataItem>('master-data')

// Project document attachments — metadata via JSON, upload via multipart form data,
// bytes streamed straight from the download endpoint (auth via the same cookie/token
// the rest of the API uses).
export const projectDocumentService = {
  list: (projectId: string) =>
    api.get<ProjectDocumentMeta[]>(`/projects/${projectId}/documents`).then((r) => r.data),
  upload: (projectId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<ProjectDocumentMeta>(`/projects/${projectId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  remove: (projectId: string, docId: string) =>
    api.delete<{ id: string }>(`/projects/${projectId}/documents/${docId}`).then((r) => r.data),
  downloadUrl: (projectId: string, docId: string) => {
    const base = api.defaults.baseURL ?? '/api'
    return `${base}/projects/${projectId}/documents/${docId}/download`
  },
}

// Expenditure document attachments — mirrors projectDocumentService.
export const expenditureDocumentService = {
  list: (expenditureId: string) =>
    api.get<ExpenditureDocumentMeta[]>(`/expenditures/${expenditureId}/documents`).then((r) => r.data),
  upload: (expenditureId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<ExpenditureDocumentMeta>(`/expenditures/${expenditureId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  remove: (expenditureId: string, docId: string) =>
    api.delete<{ id: string }>(`/expenditures/${expenditureId}/documents/${docId}`).then((r) => r.data),
  downloadUrl: (expenditureId: string, docId: string) => {
    const base = api.defaults.baseURL ?? '/api'
    return `${base}/expenditures/${expenditureId}/documents/${docId}/download`
  },
}

// Fund receipt proof-of-payment attachments — mirrors projectDocumentService.
export const fundReceiptDocumentService = {
  list: (fundReceiptId: string) =>
    api.get<FundReceiptDocumentMeta[]>(`/fund-receipts/${fundReceiptId}/documents`).then((r) => r.data),
  upload: (fundReceiptId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<FundReceiptDocumentMeta>(`/fund-receipts/${fundReceiptId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  remove: (fundReceiptId: string, docId: string) =>
    api.delete<{ id: string }>(`/fund-receipts/${fundReceiptId}/documents/${docId}`).then((r) => r.data),
  downloadUrl: (fundReceiptId: string, docId: string) => {
    const base = api.defaults.baseURL ?? '/api'
    return `${base}/fund-receipts/${fundReceiptId}/documents/${docId}/download`
  },
}

export const analyticsService = {
  dashboard: () => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
  yearWiseReport: () => api.get<YearFundFlow[]>('/reports/year-wise').then((r) => r.data),
  companyPositions: () =>
    api.get<CompanyFundPosition[]>('/reports/company-positions').then((r) => r.data),
  // Streams a proper server-generated PDF/Excel of the chosen report OR raw per-page
  // table (companies, projects, fund-receipts, …) as a Blob. `params` carries extra
  // query args like { companyId } for a company-detail export.
  exportReport: (
    type: ExportType,
    format: 'pdf' | 'excel',
    params?: Record<string, string>,
  ): Promise<Blob> =>
    api
      .get(`/reports/export/${format}`, { params: { type, ...params }, responseType: 'blob' })
      .then((r) => r.data as Blob),
}

export const userAdminService = {
  list: () => api.get<ManagedUser[]>('/users').then((r) => r.data),
  create: (data: NewUserInput) => api.post<ManagedUser>('/users', data).then((r) => r.data),
  remove: (id: string) => api.delete<{ id: string }>(`/users/${id}`).then((r) => r.data),
}

// Help-desk / support tickets. Any signed-in user can raise one and see their own;
// admins review the open queue and approve/reject (password) or reply (general).
export const supportService = {
  // Raise a general (non-password) request.
  create: (data: { subject: string; message: string }) =>
    api.post<SupportRequest>('/support-requests', data).then((r) => r.data),
  // The caller's own requests (to read admin replies / status).
  mine: () => api.get<SupportRequest[]>('/support-requests/mine').then((r) => r.data),
  // Admin: the open queue.
  list: () => api.get<SupportRequest[]>('/support-requests').then((r) => r.data),
  // Admin: approve a password request → resets to the default password, returned so the
  // admin can relay it.
  approve: (id: string) =>
    api
      .post<{ id: string; tempPassword: string }>(`/support-requests/${id}/approve`)
      .then((r) => r.data),
  reject: (id: string) =>
    api.post<{ id: string }>(`/support-requests/${id}/reject`).then((r) => r.data),
  // Admin: reply to a general request (marks it resolved).
  reply: (id: string, reply: string) =>
    api.post<{ id: string }>(`/support-requests/${id}/reply`, { reply }).then((r) => r.data),
}

export const logService = {
  list: (params?: { userEmail?: string; action?: string; entity?: string }) =>
    api.get<AuditLogEntry[]>('/logs', { params }).then((r) => r.data),
  mine: () => api.get<AuditLogEntry[]>('/logs/mine').then((r) => r.data),
  clear: () => api.delete<{ deleted: number }>('/logs').then((r) => r.data),
}
