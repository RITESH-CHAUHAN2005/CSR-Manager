import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Share, Trash2, UsersThree } from '../components/icons'
import { logService, userAdminService } from '../services/dataService'
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
import { describeLog, formatTimestamp, shareLog } from '../lib/activity'

function companyName(c: ManagedUser['companyId']): string {
  if (!c) return '—'
  if (typeof c === 'string') return c
  return c.name ?? '—'
}

const emptyUser: NewUserInput = { name: '', email: '', password: '', role: 'editor' }

const roleBadge: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  editor: 'bg-accent/10 text-accent-dark',
  viewer: 'bg-slate-100 text-slate-600',
}

export default function AdminPanel() {
  const qc = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: userAdminService.list })

  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [search, setSearch] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<NewUserInput>(emptyUser)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')

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
  const deleteM = useMutation({ mutationFn: userAdminService.remove, onSuccess: invalidateUsers })

  const editorCount = users.filter((u) => u.role === 'editor').length
  const viewerCount = users.filter((u) => u.role === 'viewer').length

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
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="Total Users" value={String(users.length)} icon={<UsersThree size={18} />} />
        <Stat label="Editors" value={String(editorCount)} />
        <Stat label="Viewers" value={String(viewerCount)} />
      </div>

      {/* Create user */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-800">Add Employee Account</h2>
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
        <h2 className="px-5 pt-5 font-semibold text-slate-800">All Users</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                      roleBadge[u.role] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{companyName(u.companyId)}</td>
                <td className="px-5 py-3 text-right">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => setDeleteId(u.id)}
                      className="text-slate-400 hover:text-danger"
                      title="Delete user"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  No users yet.
                </td>
              </tr>
            )}
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
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500">
                    {formatTimestamp(l.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{l.userEmail}</td>
                  <td className="px-3 py-3 capitalize text-slate-500">{l.userRole ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-700">{describeLog(l)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => onShare(l)}
                      title="Share this log"
                      className="text-slate-400 hover:text-primary"
                    >
                      <Share size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
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
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  )
}
