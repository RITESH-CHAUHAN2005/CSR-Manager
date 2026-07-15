import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, FileText, Receipt, UserCircle } from '../components/icons'
import {
  expenditureService,
  fundReceiptService,
  logService,
  projectService,
  supportService,
} from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  StatusBadge,
  TextArea,
  TextInput,
} from '../components/ui'
import { ChangePasswordForm } from '../components/ChangePassword'
import { DataTable, type DTColumn } from '../components/DataTable'
import { formatDate, formatINR } from '../lib/currency'
import { describeLog, formatTimestamp } from '../lib/activity'
import { getErrorMessage } from '../lib/errors'
import type { SupportRequest } from '../types'

export default function UserDashboard() {
  const { user } = useAuth()
  const mine = (createdById?: string) => createdById === user?.id

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })
  const { data: myLogs = [] } = useQuery({ queryKey: ['logs', 'mine'], queryFn: logService.mine })

  const myProjects = projects.filter((p) => mine(p.createdById))
  const myReceipts = receipts.filter((r) => mine(r.createdById))
  const myExpenditures = expenditures.filter((e) => mine(e.createdById))

  // Help desk — raise a request to the admin and read their replies.
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reqErr, setReqErr] = useState('')
  const [reqOk, setReqOk] = useState('')

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-support-requests'],
    queryFn: supportService.mine,
  })

  const createReq = useMutation({
    mutationFn: () => supportService.create({ subject, message }),
    onSuccess: () => {
      setSubject('')
      setMessage('')
      setReqOk('Request sent to your administrator ✓')
      setReqErr('')
      setTimeout(() => setReqOk(''), 3000)
      qc.invalidateQueries({ queryKey: ['my-support-requests'] })
    },
    onError: (err) => setReqErr(getErrorMessage(err, 'Could not send request')),
  })

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? 'User'}`} subtitle="Your activity & records" />

      {/* Profile */}
      <Card className="mb-6 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserCircle size={36} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-ink">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs text-muted">Role</p>
          <span className="inline-flex rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-accent-dark">
            {user?.role ?? 'editor'}
          </span>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-ink">Change Password</h2>
        <ChangePasswordForm />
      </Card>

      {/* Help desk — raise a request + read admin replies */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Raise a Request */}
        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-ink">Raise a Request</h2>
          <p className="mb-4 text-sm text-muted">
            Send a message to your administrator. They will reply, and the reply appears in
            “My Requests” below.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!subject.trim() || !message.trim()) {
                setReqErr('Add a subject and a message.')
                return
              }
              createReq.mutate()
            }}
            className="space-y-4"
          >
            <Field label="Subject">
              <TextInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your request"
              />
            </Field>
            <Field label="Message">
              <TextArea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what you need help with"
              />
            </Field>
            {reqErr && <p className="text-sm font-medium text-danger">{reqErr}</p>}
            {reqOk && <p className="text-sm font-medium text-success">{reqOk}</p>}
            <PrimaryButton type="submit" icon={false} disabled={createReq.isPending}>
              {createReq.isPending ? 'Sending…' : 'Send Request'}
            </PrimaryButton>
          </form>
        </Card>

        {/* My Requests */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink">My Requests</h2>
          {myRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              You haven't raised any requests yet.
            </p>
          ) : (
            <div className="space-y-3">
              {myRequests.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* My counts */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="My Projects" value={String(myProjects.length)} icon={<Briefcase size={18} />} />
        <Stat label="My Fund Receipts" value={String(myReceipts.length)} icon={<FileText size={18} />} />
        <Stat label="My Expenditures" value={String(myExpenditures.length)} icon={<Receipt size={18} />} />
      </div>

      {/* My records */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-ink">My Records</h2>
        {myProjects.length + myReceipts.length + myExpenditures.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            You haven't created any records yet. Add a project, fund receipt, or expenditure to get started.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {myProjects.map((p) => (
              <Row key={p.id} type="Project" label={p.name} value={formatINR(p.budget)} />
            ))}
            {myReceipts.map((r) => (
              <Row key={r.id} type="Receipt" label={r.reference} value={formatINR(r.amount)} />
            ))}
            {myExpenditures.map((e) => (
              <Row key={e.id} type="Expenditure" label={e.description || formatDate(e.date)} value={formatINR(e.amount)} />
            ))}
          </div>
        )}
      </Card>

      {/* My activity */}
      <Card className="p-2 sm:p-4">
        <h2 className="mb-4 px-3 pt-3 font-semibold text-ink">My Activity</h2>
        <DataTable
          data={myLogs.map((l) => ({
            ...l,
            activityLabel: describeLog(l),
          }))}
          columns={[
            {
              data: 'createdAt',
              title: 'When',
              render: (d: unknown, type: string) =>
                type === 'display' ? formatTimestamp(String(d)) : d,
            },
            { data: 'activityLabel', title: 'Activity' },
          ] as DTColumn[]}
          options={{ order: [] }}
        />
      </Card>
    </>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="lift p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </Card>
  )
}

function RequestRow({ request: r }: { request: SupportRequest }) {
  const isPassword = r.type === 'password'
  return (
    <div className="rounded-lg border border-line/60 p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isPassword ? 'bg-warning/15 text-warning' : 'bg-accent/10 text-accent-dark'
            }`}
          >
            {isPassword ? 'Password' : 'General'}
          </span>
          <span className="font-medium text-ink">{r.subject}</span>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <p className="text-sm text-ink/80">{r.message}</p>
      {r.reply && (
        <div className="mt-2.5 rounded-md bg-primary/5 px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
            Admin reply:
          </p>
          <p className="text-sm text-ink/80">{r.reply}</p>
        </div>
      )}
    </div>
  )
}

function Row({ type, label, value }: { type: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line/60 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{type}</span>
        <span className="text-ink/80">{label}</span>
      </div>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}
