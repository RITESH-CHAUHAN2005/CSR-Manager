import type { AuditLogEntry } from '../types'

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
  return [
    'CSR Manager — Activity Log',
    `User:   ${log.userEmail}${log.userRole ? ` (${log.userRole})` : ''}`,
    `Action: ${describeLog(log)}`,
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
