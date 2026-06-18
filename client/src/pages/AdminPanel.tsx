import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Search, Share, Trash2, UsersThree, X } from '../components/icons'
import { logService, userAdminService } from '../services/dataService'
import type { AuditLogEntry, ManagedUser } from '../types'
import { Card, ConfirmDialog, PageHeader, Select, StatusBadge } from '../components/ui'
import { describeLog, formatTimestamp, shareLog } from '../lib/activity'

function companyName(c: ManagedUser['companyId']): string {
  if (!c) return '—'
  if (typeof c === 'string') return c
  return c.name ?? '—'
}

export default function AdminPanel() {
  const qc = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: userAdminService.list })

  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [search, setSearch] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', actionFilter, userFilter],
    queryFn: () =>
      logService.list({
        action: actionFilter || undefined,
        userEmail: userFilter || undefined,
      }),
  })

  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['logs'] })
  }
  const approveM = useMutation({ mutationFn: userAdminService.approve, onSuccess: invalidateUsers })
  const rejectM = useMutation({ mutationFn: userAdminService.reject, onSuccess: invalidateUsers })
  const deleteM = useMutation({ mutationFn: userAdminService.remove, onSuccess: invalidateUsers })

  const pending = users.filter((u) => u.status === 'pending')
  const approvedCount = users.filter((u) => u.status === 'approved').length

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(
      (l) =>
        l.userEmail.toLowerCase().includes(q) ||
        describeLog(l).toLowerCase().includes(q),
    )
  }, [logs, search])

  async function onShare(log: AuditLogEntry) {
    const result = await shareLog(log)
    setShareNote(result === 'copied' ? 'Log copied to clipboard ✓' : 'Log downloaded ✓')
    setTimeout(() => setShareNote(''), 2500)
  }

  return (
    <>
      <PageHeader
        title="Admin Panel"
        subtitle="User management & live activity logs"
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="Total Users" value={String(users.length)} icon={<UsersThree size={18} />} />
        <Stat label="Approved" value={String(approvedCount)} icon={<Check size={18} />} />
        <Stat label="Pending Approval" value={String(pending.length)} icon={<Clock size={18} />} accent />
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Pending Approvals</h2>
          <div className="space-y-3">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{u.name}</p>
                  <p className="text-sm text-slate-500">{u.email} · {companyName(u.companyId)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveM.mutate(u.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                    <Check size={15} /> Approve
                  </button>
                  <button onClick={() => rejectM.mutate(u.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                    <X size={15} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All users */}
      <Card className="mb-6 overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold text-slate-800">All Users</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3 capitalize text-slate-500">{u.role}</td>
                <td className="px-5 py-3 text-slate-500">{companyName(u.companyId)}</td>
                <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-5 py-3 text-right">
                  {u.role !== 'admin' && (
                    <button onClick={() => setDeleteId(u.id)} className="text-slate-400 hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Activity logs */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Activity Logs</h2>
          {shareNote && <span className="text-sm font-medium text-success">{shareNote}</span>}
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              className="w-64 rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="register">Register</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </Select>
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.email}>{u.email}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Activity</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500">{formatTimestamp(l.createdAt)}</td>
                  <td className="px-3 py-3 text-slate-700">{l.userEmail}</td>
                  <td className="px-3 py-3 capitalize text-slate-500">{l.userRole ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-700">{describeLog(l)}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => onShare(l)} title="Share this log" className="text-slate-400 hover:text-primary">
                      <Share size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-400">No activity yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete user?"
        message="This permanently removes the user account."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={accent ? 'text-accent' : 'text-primary'}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${accent ? 'text-accent' : 'text-slate-900'}`}>{value}</p>
    </Card>
  )
}
