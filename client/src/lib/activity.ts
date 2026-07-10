import type { AuditLogEntry } from '../types'
import { formatINR } from './currency'

// Human sentence for a log entry, e.g. "created project 'Clean Water Initiative'".
export function describeLog(log: AuditLogEntry): string {
  const what = log.label ? `${log.entity} '${log.label}'` : log.entity
  const verb: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    login: 'signed in',
    login_failed: 'failed sign-in',
    register: 'registered',
    approve: 'approved',
    reject: 'rejected',
  }
  const v = verb[log.action] ?? log.action
  if (log.action === 'login' || log.action === 'login_failed' || log.action === 'register') return v
  return `${v} ${what}`
}

// ---- Field-level detail formatting (the "what exactly changed" lines) ----

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  cin: 'CIN',
  contactPerson: 'Contact Person',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  notes: 'Notes',
  startDate: 'Start Date',
  endDate: 'End Date',
  isActive: 'Active',
  company: 'Company',
  companyIds: 'Companies',
  financialYear: 'Financial Year',
  project: 'Project',
  category: 'Category',
  location: 'Location',
  budget: 'Budget',
  status: 'Status',
  derivedStatus: 'Derived Status',
  carryForwardEnabled: 'Carry Forward',
  carryForwardAmount: 'Carry Forward Amount',
  description: 'Description',
  date: 'Date',
  reference: 'Account Number',
  mode: 'Payment Mode',
  carryForward: 'Carry Forward',
  amount: 'Amount',
  approvedBy: 'Approved By',
}

const MONEY_FIELDS = new Set(['amount', 'budget', 'carryForward', 'carryForwardAmount'])
const DATE_FIELDS = new Set(['date', 'startDate', 'endDate'])

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? titleCase(key)
}

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value)
    if (!Number.isNaN(n)) return formatINR(n)
  }
  if (DATE_FIELDS.has(field)) {
    const d = new Date(String(value))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }
  return String(value)
}

// One detail line: a "from → to" change (update) or a single "value" (create/delete).
export interface LogDetailLine {
  label: string
  from?: string
  to?: string
  value?: string
}

// Structured, human-readable detail of exactly what an action changed.
export function logDetails(log: AuditLogEntry): LogDetailLine[] {
  if (log.action === 'update' && log.changes?.length) {
    return log.changes.map((c) => ({
      label: fieldLabel(c.field),
      from: formatValue(c.field, c.from),
      to: formatValue(c.field, c.to),
    }))
  }
  if (log.action === 'create' && log.after) {
    return Object.entries(log.after).map(([k, v]) => ({
      label: fieldLabel(k),
      value: formatValue(k, v),
    }))
  }
  if (log.action === 'delete' && log.before) {
    return Object.entries(log.before).map(([k, v]) => ({
      label: fieldLabel(k),
      value: formatValue(k, v),
    }))
  }
  return []
}

// "15 Jan 2024, 3:42 PM"
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Plain-text representation of a single log entry, used by the Share feature.
export function logToText(log: AuditLogEntry): string {
  const details = logDetails(log)
  const detailLines = details.map((d) =>
    d.value !== undefined ? `  • ${d.label}: ${d.value}` : `  • ${d.label}: ${d.from} → ${d.to}`,
  )
  return [
    'CSR Manager — Activity Log',
    `User:   ${log.userEmail}${log.userRole ? ` (${log.userRole})` : ''}`,
    `Action: ${describeLog(log)}`,
    ...(detailLines.length ? ['Details:', ...detailLines] : []),
    `When:   ${formatTimestamp(log.createdAt)}`,
    log.ip ? `IP:     ${log.ip}` : '',
    `Ref:    ${log.method} ${log.path}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Copy a log to the clipboard (Share). Falls back to a downloadable .txt.
export async function shareLog(log: AuditLogEntry): Promise<'copied' | 'downloaded'> {
  const text = logToText(log)
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `activity-${log.id}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
    return 'downloaded'
  }
}
