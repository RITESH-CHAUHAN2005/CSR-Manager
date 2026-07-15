import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Share, Trash2, UsersThree } from '../components/icons'
import { logService, supportService, userAdminService } from '../services/dataService'
import { DataTable, type DTColumn } from '../components/DataTable'
import { ExportButtons } from '../components/ExportButtons'
import type { AuditLogEntry, ManagedUser, NewUserInput } from '../types'
import {
  Card,
  ConfirmDialog,
  Field,
  FormSelect,
  Modal,
  PageHeader,
  PrimaryButton,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'
import { ChangePasswordForm } from '../components/ChangePassword'
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
  const [roleModal, setRoleModal] = useState<'all' | 'admin' | 'editor' | 'viewer' | null>(null)
  const [form, setForm] = useState<NewUserInput>(emptyUser)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const [deleteError, setDeleteError] = useState('')
  // After approving a reset, hold the generated temp password so the admin can relay it.
  const [resetInfo, setResetInfo] = useState<{ email: string; tempPassword: string } | null>(null)
  const [resetError, setResetError] = useState('')
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyOk, setReplyOk] = useState('')

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', actionFilter, userFilter],
    queryFn: () =>
      logService.list({
        action: actionFilter || undefined,
        userEmail: userFilter || undefined,
      }),
  })

  const { data: requests = [] } = useQuery({
    queryKey: ['support-requests'],
    queryFn: supportService.list,
  })

  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['logs'] })
  }
  const invalidateRequests = () => {
    qc.invalidateQueries({ queryKey: ['support-requests'] })
    qc.invalidateQueries({ queryKey: ['logs'] })
  }
  const approveM = useMutation({
    mutationFn: supportService.approve,
    onSuccess: (res, id) => {
      const r = requests.find((x) => x.id === id)
      setResetInfo({ email: r?.email ?? '', tempPassword: res.tempPassword })
      setResetError('')
      invalidateRequests()
    },
    onError: (err) => setResetError(getErrorMessage(err, 'Could not approve request')),
  })
  const rejectM = useMutation({
    mutationFn: supportService.reject,
    onSuccess: invalidateRequests,
    onError: (err) => setResetError(getErrorMessage(err, 'Could not reject request')),
  })
  const replyM = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => supportService.reply(id, reply),
    onSuccess: (_res, v) => {
      setReplyText((d) => ({ ...d, [v.id]: '' }))
      setReplyOk('Reply sent ✓')
      setTimeout(() => setReplyOk(''), 2500)
      invalidateRequests()
    },
    onError: (err) => setResetError(getErrorMessage(err, 'Could not send reply')),
  })
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
  const usersCsv = {
    filename: 'users',
    headers: ['Name', 'Email', 'Role', 'Company'],
    rows: users.map((u) => [u.name, u.email, u.role, companyName(u.companyId)]) as (string | number)[][],
  }
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

  const logsCsv = {
    filename: 'activity-logs',
    headers: ['When', 'User', 'Role', 'Activity'],
    rows: filteredLogs.map((l) => [formatTimestamp(l.createdAt), l.userEmail, l.userRole ?? '—', describeLog(l)]) as (string | number)[][],
  }

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
        <Stat
          label="Total Users"
          value={String(users.length)}
          icon={<UsersThree size={18} />}
          onClick={() => setRoleModal('all')}
        />
        <Stat label="Admins" value={String(adminCount)} onClick={() => setRoleModal('admin')} />
        <Stat label="Editors" value={String(editorCount)} onClick={() => setRoleModal('editor')} />
        <Stat label="Viewers" value={String(viewerCount)} onClick={() => setRoleModal('viewer')} />
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

      {/* Change password */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-ink">Change Password</h2>
        <ChangePasswordForm inline />
      </Card>

      {/* Help desk requests */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">
            Help Desk Requests
            {requests.length > 0 && (
              <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                {requests.length} pending
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {replyOk && <span className="text-sm text-success">{replyOk}</span>}
            {resetError && <span className="text-sm text-danger">{resetError}</span>}
          </div>
        </div>

        {resetInfo && (
          <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            Password for <span className="font-semibold">{resetInfo.email}</span> has been reset to{' '}
            <span className="font-mono font-semibold">{resetInfo.tempPassword}</span>. Share it with the
            user — they'll be asked to set their own password on next sign in.
            <button
              onClick={() => setResetInfo(null)}
              className="ml-3 font-medium underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {requests.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.type === 'password'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-accent/10 text-accent-dark'
                        }`}
                      >
                        {r.type === 'password' ? 'Password' : 'General'}
                      </span>
                      <p className="truncate text-sm font-medium text-ink">{r.subject}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {r.name} · {r.email} · requested {formatTimestamp(r.createdAt)}
                    </p>
                  </div>
                  {r.type === 'password' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => { setResetError(''); approveM.mutate(r.id) }}
                        disabled={approveM.isPending || rejectM.isPending}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                      >
                        Approve &amp; Reset
                      </button>
                      <button
                        onClick={() => { setResetError(''); rejectM.mutate(r.id) }}
                        disabled={approveM.isPending || rejectM.isPending}
                        className="rounded-lg border border-line bg-surface/70 px-3 py-1.5 text-sm font-medium text-danger hover:bg-ink/5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {r.type === 'general' && (
                  <div className="mt-2">
                    <p className="whitespace-pre-wrap rounded-lg bg-ink/[0.03] px-3 py-2 text-sm text-ink/80">
                      {r.message}
                    </p>
                    <div className="mt-2">
                      <TextArea
                        rows={2}
                        value={replyText[r.id] ?? ''}
                        onChange={(e) =>
                          setReplyText((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        placeholder="Type a reply…"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            setResetError('')
                            replyM.mutate({ id: r.id, reply: replyText[r.id] || '' })
                          }}
                          disabled={
                            !(replyText[r.id] || '').trim() ||
                            replyM.isPending ||
                            rejectM.isPending
                          }
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                        >
                          Send Reply
                        </button>
                        <button
                          onClick={() => { setResetError(''); rejectM.mutate(r.id) }}
                          disabled={replyM.isPending || rejectM.isPending}
                          className="rounded-lg border border-line bg-surface/70 px-3 py-1.5 text-sm font-medium text-danger hover:bg-ink/5 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* All users */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="font-semibold text-ink">All Users</h2>
          <div className="flex flex-wrap items-center gap-3">
            {deleteError && <span className="text-sm text-danger">{deleteError}</span>}
            <ExportButtons entity="users" csv={usersCsv} />
          </div>
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
            <ExportButtons entity="activity-logs" csv={logsCsv} />
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

      <Modal
        open={roleModal !== null}
        onClose={() => setRoleModal(null)}
        title={
          roleModal === 'all'
            ? `Total Users (${users.length})`
            : `${roleModal ? roleModal.charAt(0).toUpperCase() + roleModal.slice(1) : ''}s`
        }
      >
        <RoleUserList
          users={roleModal === 'all' ? users : users.filter((u) => u.role === roleModal)}
        />
      </Modal>
    </>
  )
}

function RoleUserList({ users }: { users: ManagedUser[] }) {
  if (users.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">No users in this role.</p>
  }
  return (
    <ul className="divide-y divide-line/60">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{u.name}</p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                roleBadge[u.role] ?? 'bg-ink/10 text-muted'
              }`}
            >
              {u.role}
            </span>
            <span className="text-xs text-muted">{companyName(u.companyId)}</span>
          </div>
        </li>
      ))}
    </ul>
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

function Stat({
  label,
  value,
  icon,
  onClick,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  onClick: () => void
}) {
  return (
    <Card className="lift p-5 transition-colors hover:bg-ink/[0.03]">
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted">{label}</p>
          {icon && <span className="text-primary">{icon}</span>}
        </div>
        <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      </button>
    </Card>
  )
}
