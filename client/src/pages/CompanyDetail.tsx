import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, MapPin, Pencil, Phone, User } from '../components/icons'
import {
  companyService,
  expenditureService,
  financialYearService,
  fundReceiptService,
  projectService,
} from '../services/dataService'
import type { Company } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  Field,
  Modal,
  StatusBadge,
  TextArea,
  TextInput,
} from '../components/ui'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export default function CompanyDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { canWrite } = useAuth()
  const qc = useQueryClient()

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })

  const company = companies.find((c) => c.id === id)

  const yearName = (fyId: string) => years.find((y) => y.id === fyId)?.name ?? '—'

  // Per-company slices.
  const myReceipts = useMemo(() => receipts.filter((r) => r.companyId === id), [receipts, id])
  const myExpenditures = useMemo(() => expenditures.filter((e) => e.companyId === id), [expenditures, id])
  const myProjects = useMemo(() => projects.filter((p) => p.companyId === id), [projects, id])

  // Fund overview totals.
  const totalReceived = sum(myReceipts.map((r) => r.amount))
  const carryForward = sum(myReceipts.map((r) => r.carryForward))
  const activeProjects = myProjects.filter((p) => p.status === 'active').length

  // Year-wise fund summary — only years where this company has any activity.
  const yearRows = useMemo(() => {
    return years
      .map((y) => {
        const received = sum(myReceipts.filter((r) => r.financialYearId === y.id).map((r) => r.amount))
        const carryForwardIn = sum(
          myReceipts.filter((r) => r.financialYearId === y.id).map((r) => r.carryForward),
        )
        const expenditure = sum(
          myExpenditures.filter((e) => e.financialYearId === y.id).map((e) => e.amount),
        )
        const hasProject = myProjects.some((p) => p.financialYearId === y.id)
        const balance = received + carryForwardIn - expenditure
        return { id: y.id, name: y.name, received, carryForwardIn, expenditure, balance, hasProject }
      })
      .filter((r) => r.received > 0 || r.carryForwardIn > 0 || r.expenditure > 0 || r.hasProject)
  }, [years, myReceipts, myExpenditures, myProjects])

  // ---- Inline edit ----
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Omit<Company, 'id'>>({
    name: '', cin: '', contactPerson: '', email: '', phone: '', address: '', notes: '',
  })
  const [formError, setFormError] = useState('')
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<Company> }) => companyService.update(v.id, v.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['company-positions'] })
    },
  })
  function openEdit() {
    if (!company) return
    setForm({
      name: company.name,
      cin: company.cin ?? '',
      contactPerson: company.contactPerson ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      notes: company.notes ?? '',
    })
    setFormError('')
    setEditOpen(true)
  }
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    try {
      await updateM.mutateAsync({ id, data: form })
      setEditOpen(false)
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  if (companies.length > 0 && !company) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">This company no longer exists.</p>
        <button onClick={() => navigate('/companies')} className="mt-4 text-sm font-medium text-primary hover:underline">
          ← Back to Companies
        </button>
      </div>
    )
  }
  if (!company) return <p className="py-20 text-center text-sm text-muted">Loading…</p>

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/companies')}
            className="mt-1 rounded-xl border border-line p-1.5 text-muted hover:bg-ink/5"
            aria-label="Back to companies"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{company.name}</h1>
            {company.cin && <p className="mt-0.5 text-sm text-muted">#&nbsp;{company.cin}</p>}
          </div>
        </div>
        {canWrite && (
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            <Pencil size={15} /> Edit
          </button>
        )}
      </div>

      {/* Contact + Fund overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Contact Information</h2>
          <div className="space-y-3 text-sm text-ink/80">
            {company.contactPerson && (
              <p className="flex items-center gap-3"><User size={16} className="text-muted" /> {company.contactPerson}</p>
            )}
            {company.email && (
              <p className="flex items-center gap-3"><Mail size={16} className="text-muted" /> {company.email}</p>
            )}
            {company.phone && (
              <p className="flex items-center gap-3"><Phone size={16} className="text-muted" /> {company.phone}</p>
            )}
            {company.address && (
              <p className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-muted" /> {company.address}</p>
            )}
            {!company.contactPerson && !company.email && !company.phone && !company.address && (
              <p className="text-muted">No contact details on file.</p>
            )}
            {company.notes && (
              <p className="mt-2 border-t border-line/60 pt-3 text-muted">{company.notes}</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Fund Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <OverviewStat label="Total Received" value={formatINR(totalReceived)} />
            <OverviewStat label="Carry Forward" value={formatINR(carryForward)} />
            <OverviewStat label="Total Projects" value={String(myProjects.length)} />
            <OverviewStat label="Active Projects" value={String(activeProjects)} />
          </div>
        </Card>
      </div>

      {/* Year-wise fund summary */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Year-wise Fund Summary</h2>
        {yearRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No fund activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="sticky top-0 z-10 bg-surface/85 backdrop-blur border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">Financial Year</th>
                  <th className="px-3 py-3 text-right font-medium">Received</th>
                  <th className="px-3 py-3 text-right font-medium">Carry Forward In</th>
                  <th className="px-3 py-3 text-right font-medium">Expenditure</th>
                  <th className="px-3 py-3 text-right font-medium">Balance</th>
                  <th className="px-3 py-3 text-right font-medium">Carry Forward Out</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink/[0.03]">
                    <td className="px-3 py-3 font-medium text-ink/80">{r.name}</td>
                    <td className="px-3 py-3 text-right text-ink/80">{formatINR(r.received)}</td>
                    <td className="px-3 py-3 text-right text-muted">{formatINR(r.carryForwardIn)}</td>
                    <td className="px-3 py-3 text-right text-danger">{formatINR(r.expenditure)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-success">{formatINR(r.balance)}</td>
                    <td className="px-3 py-3 text-right text-muted">{formatINR(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Projects */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Projects</h2>
        {myProjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No projects yet.</p>
        ) : (
          <div className="divide-y divide-line/60">
            {myProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted">
                    {yearName(p.financialYearId)} · {p.category} · {p.location}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-ink">{formatINR(p.budget)}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fund receipts */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Fund Receipts</h2>
        {myReceipts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No fund receipts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="sticky top-0 z-10 bg-surface/85 backdrop-blur border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Year</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Mode</th>
                  <th className="px-3 py-3 text-right font-medium">Carry Forward</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...myReceipts]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink/[0.03]">
                      <td className="px-3 py-3 text-ink/80">{formatDate(r.date)}</td>
                      <td className="px-3 py-3 text-muted">{yearName(r.financialYearId)}</td>
                      <td className="px-3 py-3 text-muted">{r.reference}</td>
                      <td className="px-3 py-3 text-muted">{r.mode}</td>
                      <td className="px-3 py-3 text-right text-muted">{formatINR(r.carryForward)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-success">{formatINR(r.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Donor Company">
        <form onSubmit={submitEdit} className="space-y-4">
          <Field label="Company Name *">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Registration / CIN Number">
            <TextInput value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact Person">
              <TextInput value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </Field>
            <Field label="Phone">
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Address">
            <TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Notes">
            <TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink/[0.03] px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  )
}
