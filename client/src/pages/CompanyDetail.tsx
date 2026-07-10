import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Mail, MapPin, Pencil, Phone, User } from '../components/icons'
import {
  companyService,
  expenditureService,
  financialYearService,
  fundReceiptService,
  projectService,
} from '../services/dataService'
import { formatDate, formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import type { Company, Project } from '../types'
import {
  DetailModal,
  Field,
  Modal,
  StatusBadge,
  TextArea,
  TextInput,
} from '../components/ui'
import { DataTable, type DTColumn } from '../components/DataTable'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const money = (d: unknown, type: string) => (type === 'display' ? formatINR(Number(d)) : Number(d))
const dateCell = (d: unknown, type: string) => (type === 'display' ? formatDate(String(d)) : d)

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
  const companyNames = (ids: string[]) =>
    ids.map((cid) => companies.find((c) => c.id === cid)?.name ?? '—').join(', ') || '—'

  // Per-company slices.
  const myReceipts = useMemo(() => receipts.filter((r) => r.companyId === id), [receipts, id])
  const myExpenditures = useMemo(() => expenditures.filter((e) => e.companyId === id), [expenditures, id])
  const myProjects = useMemo(() => projects.filter((p) => p.companyIds?.includes(id)), [projects, id])

  // Fund overview totals — Carry Forward = legacy receipt carry-in + unused
  // budget carried forward, recorded per-expenditure against Ongoing projects.
  const totalReceived = sum(myReceipts.map((r) => r.amount))
  const carryForward =
    sum(myReceipts.map((r) => r.carryForward ?? 0)) +
    sum(myExpenditures.map((e) => e.carryForwardAmount ?? 0))
  const totalExpenditure = sum(myExpenditures.map((e) => e.amount))
  const currentBalance = totalReceived + carryForward - totalExpenditure
  const activeProjects = myProjects.filter((p) => p.status === 'active').length

  // Year-wise fund summary — only years where this company has any activity.
  // Projects no longer carry a financial year, so "has a project" is based on
  // whether the project's start date falls inside the year's date range.
  const yearRows = useMemo(() => {
    return years
      .map((y) => {
        const received = sum(myReceipts.filter((r) => r.financialYearId === y.id).map((r) => r.amount))
        const carryForwardIn = sum(
          myReceipts.filter((r) => r.financialYearId === y.id).map((r) => r.carryForward ?? 0),
        )
        const expenditure = sum(
          myExpenditures.filter((e) => e.financialYearId === y.id).map((e) => e.amount),
        )
        const hasProject = myProjects.some(
          (p) => p.startDate && p.startDate >= y.startDate && p.startDate <= y.endDate,
        )
        const balance = received + carryForwardIn - expenditure
        return { id: y.id, name: y.name, received, carryForwardIn, expenditure, balance, hasProject }
      })
      .filter((r) => r.received > 0 || r.carryForwardIn > 0 || r.expenditure > 0 || r.hasProject)
  }, [years, myReceipts, myExpenditures, myProjects])

  const receiptRows = useMemo(
    () =>
      [...myReceipts]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({ ...r, yearLabel: yearName(r.financialYearId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myReceipts, years],
  )

  const projectRows = useMemo(
    () =>
      myProjects.map((p) => ({
        ...p,
        companyNames: companyNames(p.companyIds ?? []),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myProjects, companies],
  )

  const projectPeriod = (p: Project) => {
    const start = p.startDate ? formatDate(String(p.startDate)) : ''
    if (p.derivedStatus === 'ongoing') return start ? `${start} – Ongoing` : 'Ongoing'
    return [p.startDate, p.endDate].filter(Boolean).map((d) => formatDate(String(d))).join(' – ')
  }

  // ---- Project detail view ----
  const [viewProject, setViewProject] = useState<Project | null>(null)

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

      {/* Contact + Fund overview + Year-wise summary + Projects + Fund receipts —
          one flat, borderless surface divided by rule lines (no nested card boxes). */}
      <div className="divide-y divide-line/70 rounded-2xl border border-line/70">
        <div className="grid grid-cols-1 divide-y divide-line/70 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-6">
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
          </div>

          <div className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Fund Overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-line/60 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="border-b border-r border-line/60 px-3 py-2 font-medium">Total Received</th>
                    <th className="border-b border-r border-line/60 px-3 py-2 font-medium">Carry Forward</th>
                    <th className="border-b border-r border-line/60 px-3 py-2 font-medium">Total Expenditure</th>
                    <th className="border-b border-r border-line/60 px-3 py-2 font-medium">Current Balance</th>
                    <th className="border-b border-r border-line/60 px-3 py-2 font-medium">Total Projects</th>
                    <th className="border-b border-line/60 px-3 py-2 font-medium">Active Projects</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-line/60 px-3 py-3 font-semibold text-ink">{formatINR(totalReceived)}</td>
                    <td className="border-r border-line/60 px-3 py-3 font-semibold text-ink">{formatINR(carryForward)}</td>
                    <td className="border-r border-line/60 px-3 py-3 font-semibold text-danger">{formatINR(totalExpenditure)}</td>
                    <td className="border-r border-line/60 px-3 py-3 font-semibold text-success">{formatINR(currentBalance)}</td>
                    <td className="border-r border-line/60 px-3 py-3 font-semibold text-ink">{myProjects.length}</td>
                    <td className="px-3 py-3 font-semibold text-success">{activeProjects}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Year-wise fund summary */}
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Year-wise Fund Summary</h2>
          {yearRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No fund activity recorded yet.</p>
          ) : (
            <DataTable
              className="display nowrap csr-dt-grid"
              data={yearRows}
              columns={[
                { data: 'name', title: 'Financial Year' },
                { data: 'received', title: 'Received', className: 'text-right', render: money },
                { data: 'carryForwardIn', title: 'Carry Forward In', className: 'text-right', render: money },
                { data: 'expenditure', title: 'Expenditure', className: 'text-right' },
                { data: 'balance', title: 'Balance', className: 'text-right' },
                { data: 'balance', title: 'Carry Forward Out', className: 'text-right', render: money },
              ] as DTColumn[]}
              slots={{
                3: (_cell, row) => <span className="text-danger">{formatINR(row.expenditure)}</span>,
                4: (_cell, row) => (
                  <span className="font-semibold text-success">{formatINR(row.balance)}</span>
                ),
              }}
              options={{ searching: false, order: [] }}
            />
          )}
        </div>

        {/* Projects */}
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Projects</h2>
          {projectRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No projects yet.</p>
          ) : (
            <DataTable
              className="display nowrap csr-dt-grid"
              data={projectRows}
              columns={[
                { data: 'name', title: 'Project' },
                { data: 'companyNames', title: 'Companies' },
                { data: 'category', title: 'Category' },
                { data: 'budget', title: 'Budget', className: 'text-right', render: money },
                { data: 'status', title: 'Status' },
                { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
              ] as DTColumn[]}
              slots={{
                4: (_cell, row) => <StatusBadge status={row.status} />,
                5: (_cell, row) => (
                  <button
                    onClick={() => setViewProject(row as Project)}
                    className="text-muted hover:text-primary"
                    title="View details, description & notes"
                  >
                    <Eye size={16} />
                  </button>
                ),
              }}
              options={{ searching: false, order: [] }}
            />
          )}
        </div>

        {/* Fund receipts */}
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Fund Receipts</h2>
          {myReceipts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No fund receipts yet.</p>
          ) : (
            <DataTable
              className="display nowrap csr-dt-grid"
              data={receiptRows}
              columns={[
                { data: 'date', title: 'Date', render: dateCell },
                { data: 'yearLabel', title: 'Year' },
                { data: 'reference', title: 'Account Number' },
                { data: 'amount', title: 'Amount', className: 'text-right' },
              ] as DTColumn[]}
              slots={{
                3: (_cell, row) => (
                  <span className="font-semibold text-success">{formatINR(row.amount)}</span>
                ),
              }}
              options={{ searching: false, order: [] }}
            />
          )}
        </div>
      </div>

      {/* Project detail view */}
      <DetailModal
        open={!!viewProject}
        onClose={() => setViewProject(null)}
        title={viewProject?.name ?? 'Project'}
        rows={
          viewProject
            ? [
                { label: 'Companies', value: companyNames(viewProject.companyIds ?? []) },
                { label: 'Status', value: <StatusBadge status={viewProject.status} /> },
                { label: 'Derived Status', value: viewProject.derivedStatus === 'ongoing' ? 'Ongoing' : 'Other than Ongoing' },
                { label: 'Budget', value: formatINR(viewProject.budget) },
                { label: 'Category', value: viewProject.category },
                { label: 'Location', value: viewProject.location },
                { label: 'Period', value: projectPeriod(viewProject) },
              ]
            : []
        }
        sections={
          viewProject
            ? [
                { label: 'Description', value: viewProject.description },
                { label: 'Notes', value: viewProject.notes },
              ]
            : []
        }
      />

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
