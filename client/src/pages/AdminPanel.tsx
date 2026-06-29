import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Share, Trash2, UsersThree } from '../components/icons'
import { logService, userAdminService } from '../services/dataService'
import { DataTable, type DTColumn } from '../components/DataTable'
import type { AuditLogEntry, ManagedUser, NewUserInput } from '../types'
import {
  Card,
  ConfirmDialog,
  Field,
  FormSelect,
  PageHeader,
  PrimaryButton,
  Select,
  TextInput,
} from '../components/ui'
import { getErrorMessage } from '../lib/errors'
import { describeLog, formatTimestamp, logDetails, shareLog } from '../lib/activity'
import { useAuth } from '../context/AuthContext'

function companyName(c: ManagedUser['companyId']): string {
  if (!c) return '—'
  if (typeof c === 'string') return c
  return c.name ?? '—'
}

const emptyUser: NewUserInput = { name: '', email: '', password: '', role: 'editor' }

const roleBadge: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  editor: 'bg-accent/10 text-accent-dark',
  viewer: 'bg-ink/10 text-muted',
}

export default function AdminPanel() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: userAdminService.list })

  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [search, setSearch] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [form, setForm] = useState<NewUserInput>(emptyUser)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const [deleteError, setDeleteError] = useState('')

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
  const createM = useMutation({ mutationFn: userAdminService.create, onSuccess: invalidateUsers })
  const deleteM = useMutation({
    mutationFn: userAdminService.remove,
    onSuccess: invalidateUsers,
    onError: (err) => setDeleteError(getErrorMessage(err, 'Could not delete user')),
  })
  const clearM = useMutation({
    mutationFn: () => logService.clear(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs'] })
      setShareNote('Activity logs cleared ✓')
      setTimeout(() => setShareNote(''), 2500)
    },
  })

  const adminCount = users.filter((u) => u.role === 'admin').length
  const editorCount = users.filter((u) => u.role === 'editor').length
  const viewerCount = users.filter((u) => u.role === 'viewer').length

  const userRows = users.map((u) => ({ ...u, companyLabel: companyName(u.companyId) }))
  const userColumns: DTColumn[] = [
    { data: 'name', title: 'Name' },
    { data: 'email', title: 'Email' },
    { data: 'role', title: 'Role' },
    { data: 'companyLabel', title: 'Company' },
    { data: null, title: '', orderable: false, className: 'text-right' },
  ]

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(
      (l) => l.userEmail.toLowerCase().includes(q) || describeLog(l).toLowerCase().includes(q),
    )
  }, [logs, search])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormOk('')
    try {
      const u = await createM.mutateAsync(form)
      setFormOk(`${u.email} created as ${u.role}.`)
      setForm(emptyUser)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create user'))
    }
  }

  async function onShare(log: AuditLogEntry) {
    const result = await shareLog(log)
    setShareNote(result === 'copied' ? 'Log copied to clipboard ✓' : 'Log downloaded ✓')
    setTimeout(() => setShareNote(''), 2500)
  }

  return (
    <>
      <PageHeader title="Admin Panel" subtitle="User management & live activity logs" />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Users" value={String(users.length)} icon={<UsersThree size={18} />} />
        <Stat label="Admins" value={String(adminCount)} />
        <Stat label="Editors" value={String(editorCount)} />
        <Stat label="Viewers" value={String(viewerCount)} />
      </div>

      {/* Create user */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-ink">Add User Account</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Full Name">
            <TextInput
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@company.com"
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 chars, 1 letter + 1 number"
            />
          </Field>
          <Field label="Role">
            <FormSelect
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as NewUserInput['role'] })}
            >
              <option value="admin">Admin — full access + user management</option>
              <option value="editor">Editor — add / edit / delete</option>
              <option value="viewer">Viewer — read-only</option>
            </FormSelect>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
            <PrimaryButton type="submit" disabled={createM.isPending}>
              {createM.isPending ? 'Creating…' : 'Create User'}
            </PrimaryButton>
            {formError && <span className="text-sm text-danger">{formError}</span>}
            {formOk && <span className="text-sm text-success">{formOk}</span>}
          </div>
        </form>
      </Card>

      {/* All users */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="font-semibold text-ink">All Users</h2>
          {deleteError && <span className="text-sm text-danger">{deleteError}</span>}
        </div>
        <div className="p-2 sm:p-4">
          <DataTable
            data={userRows}
            columns={userColumns}
            slots={{
              2: (_cell, row) => (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                    roleBadge[row.role] ?? 'bg-ink/10 text-muted'
                  }`}
                >
                  {row.role}
                </span>
              ),
              4: (_cell, row) =>
                currentUser?.id === row.id ? (
                  <span className="text-xs text-muted">You</span>
                ) : (
                  <button
                    onClick={() => setDeleteId(row.id)}
                    className="text-muted hover:text-danger"
                    title="Delete user"
                  >
                    <Trash2 size={16} />
                  </button>
                ),
            }}
            options={{ order: [] }}
          />
        </div>
      </Card>

      {/* Activity logs */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Activity Logs</h2>
          <div className="flex items-center gap-3">
            {shareNote && <span className="text-sm font-medium text-success">{shareNote}</span>}
            {logs.length > 0 && (
              <button
                onClick={() => setClearOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3 py-1.5 text-sm font-medium text-danger"
              >
                <Trash2 size={15} /> Clear Logs
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              className="w-full rounded-xl border border-line bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
            />
          </div>
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
          </Select>
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.email}>
                {u.email}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-surface/85 text-left text-xs uppercase tracking-wide text-muted backdrop-blur">
                <th className="px-3 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Activity</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => (
                <tr key={l.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink/[0.03]">
                  <td className="px-3 py-3 whitespace-nowrap text-muted">
                    {formatTimestamp(l.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-ink/80">{l.userEmail}</td>
                  <td className="px-3 py-3 capitalize text-muted">{l.userRole ?? '—'}</td>
                  <td className="px-3 py-3 align-top text-ink/80">
                    <span className="font-medium capitalize">{describeLog(l)}</span>
                    <LogDetails log={l} />
                  </td>
                  <td className="px-3 py-3 align-top text-right">
                    <button
                      onClick={() => onShare(l)}
                      title="Share this log"
                      className="text-muted hover:text-primary"
                    >
                      <Share size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted">
                    No activity yet.
                  </td>
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
          setDeleteError('')
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear all activity logs?"
        message="This permanently deletes every activity log entry. This cannot be undone."
        onCancel={() => setClearOpen(false)}
        onConfirm={() => { clearM.mutate(); setClearOpen(false) }}
      />
    </>
  )
}

// Field-level detail under each activity row: created values, before → after, or removed values.
function LogDetails({ log }: { log: AuditLogEntry }) {
  const details = logDetails(log)
  if (details.length === 0) return null
  const isUpdate = log.action === 'update'
  return (
    <ul className="mt-1.5 space-y-1 border-l-2 border-line pl-3 text-xs text-muted">
      {details.map((d, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-1.5">
          <span className="font-medium text-ink/80">{d.label}:</span>
          {isUpdate ? (
            <>
              <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through decoration-danger/40">
                {d.from}
              </span>
              <span className="text-muted">→</span>
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{d.to}</span>
            </>
          ) : (
            <span className="text-ink/80">{d.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="lift p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </Card>
  )
}
