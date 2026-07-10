import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import {
  companyService,
  financialYearService,
  fundReceiptService,
  masterDataService,
  projectDocumentService,
  projectService,
} from '../services/dataService'
import type { DerivedStatus, FundReceipt, Project, ProjectStatus } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { previewProjectEndDate } from '../lib/financialYear'
import { commitmentStatusForProject, committedTotal } from '../lib/projectContributions'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import { DocumentAttachments, StagedAttachments } from '../components/DocumentAttachments'
import {
  Checkbox,
  ConfirmDialog,
  DatePicker,
  DetailModal,
  Field,
  FormSelect,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from '../components/ui'

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
// On Hold / Cancelled projects must carry a reason (description or notes) for clarity.
const REASON_REQUIRED: ProjectStatus[] = ['on_hold', 'cancelled']

// Per-company reconciliation shown on a project's detail view: what each donor
// pledged, what has actually arrived via Fund Receipts, and what's still outstanding.
function CommitmentTable({
  project,
  receipts,
  companyName,
}: {
  project: Project
  receipts: FundReceipt[]
  companyName: (id: string) => string
}) {
  const rows = commitmentStatusForProject(project, receipts)
  if (rows.length === 0) return null
  const totals = rows.reduce(
    (t, r) => ({ committed: t.committed + r.committed, received: t.received + r.received, pending: t.pending + r.pending }),
    { committed: 0, received: 0, pending: 0 },
  )
  return (
    <div className="mt-5 border-t border-line/60 pt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Commitments</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="py-1 text-left font-medium">Company</th>
              <th className="py-1 text-right font-medium">Committed</th>
              <th className="py-1 text-right font-medium">Received</th>
              <th className="py-1 text-right font-medium">Pending</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {rows.map((r) => (
              <tr key={r.companyId} className="border-t border-line/50">
                <td className="py-1.5 pr-3">{companyName(r.companyId)}</td>
                <td className="py-1.5 text-right">{formatINR(r.committed)}</td>
                <td className="py-1.5 text-right text-success">{formatINR(r.received)}</td>
                <td className={`py-1.5 text-right ${r.pending > 0 ? 'text-warning' : 'text-muted'}`}>
                  {r.pending > 0 ? formatINR(r.pending) : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <td className="py-1.5 pr-3">Total</td>
              <td className="py-1.5 text-right">{formatINR(totals.committed)}</td>
              <td className="py-1.5 text-right text-success">{formatINR(totals.received)}</td>
              <td className="py-1.5 text-right">{totals.pending > 0 ? formatINR(totals.pending) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {project.budget !== totals.committed && (
        <p className="mt-2 text-xs text-muted">
          Approved Budget {formatINR(project.budget)} ·{' '}
          <span className="text-warning">
            {project.budget > totals.committed ? 'Shortfall' : 'Excess'}{' '}
            {formatINR(Math.abs(project.budget - totals.committed))}
          </span>
        </p>
      )}
    </div>
  )
}

const emptyForm = {
  name: '',
  companyIds: [] as string[],
  // Per-company pledge, keyed by company id. Held as strings so a half-typed number
  // input doesn't get coerced to 0 mid-keystroke.
  amounts: {} as Record<string, string>,
  status: 'active' as ProjectStatus,
  derivedStatus: 'other' as DerivedStatus,
  budget: '' as number | string,
  category: '',
  location: '',
  startDate: '',
  description: '',
  notes: '',
}

export default function Projects() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({
    queryKey: ['financial-years'],
    queryFn: financialYearService.list,
  })
  const { data: masterData = [] } = useQuery({ queryKey: ['master-data'], queryFn: masterDataService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const categoryOptions = useMemo(() => masterData.filter((m) => m.type === 'category'), [masterData])

  const [companyFilter, setCompanyFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [viewing, setViewing] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  // Once the user types their own Approved Budget we stop auto-filling it from the
  // commitments — but we keep showing the gap so the override is never silent.
  const [budgetDirty, setBudgetDirty] = useState(false)
  // Staged for a brand-new project (no id yet) — uploaded once creation succeeds.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [docUploadWarning, setDocUploadWarning] = useState('')

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const companyNames = (ids: string[] = []) => ids.map(companyName).join(', ') || '—'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(
      (p) =>
        (!companyFilter || p.companyIds?.includes(companyFilter)) &&
        (!q ||
          [p.name, p.category, p.location, p.description, companyNames(p.companyIds)].some((f) =>
            (f ?? '').toLowerCase().includes(q),
          )),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, companyFilter, search, companies])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['company-positions'] })
  }
  const createM = useMutation({
    mutationFn: (v: Omit<Project, 'id'>) => projectService.create(v),
    onSuccess: invalidate,
  })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<Project> }) => projectService.update(v.id, v.data),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({
    mutationFn: projectService.remove,
    onSuccess: invalidate,
    onError: (err) => setDeleteError(getErrorMessage(err, 'Could not delete project')),
  })

  // Preview of the End Date the server will compute, from the FY the chosen
  // Start Date falls into (Ongoing -> +3 years; Other than Ongoing -> +1 year).
  // Not user-editable.
  const endDatePreview = useMemo(
    () => previewProjectEndDate(years, form.derivedStatus, form.startDate),
    [years, form.derivedStatus, form.startDate],
  )

  // What the selected companies have pledged, in total.
  const committedSum = useMemo(
    () => form.companyIds.reduce((s, id) => s + (Number(form.amounts[id]) || 0), 0),
    [form.companyIds, form.amounts],
  )

  // Approved Budget defaults to the commitments total, so it never has to be typed.
  // The moment the user edits it themselves we leave it alone.
  useEffect(() => {
    if (budgetDirty) return
    setForm((f) => ({ ...f, budget: committedSum ? String(committedSum) : '' }))
  }, [committedSum, budgetDirty])

  // Budget above the pledges = a funding shortfall; below = the companies have
  // over-committed. Neither is an error, so we surface the gap rather than block on it.
  const budgetGap = (Number(form.budget) || 0) - committedSum

  function setDerivedStatus(derivedStatus: DerivedStatus) {
    setForm((f) => ({ ...f, derivedStatus }))
  }

  function toggleCompany(id: string, checked: boolean) {
    setForm((f) => {
      const amounts = { ...f.amounts }
      if (!checked) delete amounts[id]
      return {
        ...f,
        amounts,
        companyIds: checked ? [...f.companyIds, id] : f.companyIds.filter((c) => c !== id),
      }
    })
  }

  function setCommitment(id: string, value: string) {
    setForm((f) => ({ ...f, amounts: { ...f.amounts, [id]: value } }))
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, companyIds: companies[0] ? [companies[0].id] : [] })
    setBudgetDirty(false)
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  function openEdit(p: Project) {
    setEditing(p)
    const amounts: Record<string, string> = {}
    for (const c of p.commitments ?? []) {
      if (c.committedAmount) amounts[c.companyId] = String(c.committedAmount)
    }
    // Treat an existing budget that doesn't equal the pledges as a deliberate override
    // (projects created before commitments existed land here), so editing won't quietly
    // overwrite the approved figure with a commitments total of 0.
    setBudgetDirty(Number(p.budget) !== committedTotal(p))
    setForm({ ...emptyForm, ...p, companyIds: p.companyIds ?? [], amounts })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (form.companyIds.length === 0) {
      setFormError('Select at least one company.')
      return
    }
    if (!form.startDate) {
      setFormError('Start date is required.')
      return
    }
    if (REASON_REQUIRED.includes(form.status) && !form.description.trim() && !form.notes.trim()) {
      setFormError('Add a description or notes explaining why the project is On Hold or Cancelled.')
      return
    }
    // The End Date is always derived server-side, as is companyIds (from commitments).
    const { amounts, ...rest } = form
    const payload = {
      ...rest,
      budget: Number(form.budget) || 0,
      commitments: form.companyIds.map((companyId) => ({
        companyId,
        committedAmount: Number(amounts[companyId]) || 0,
      })),
    }
    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, data: payload })
      } else {
        const created = await createM.mutateAsync(payload)
        if (pendingFiles.length > 0) {
          const results = await Promise.allSettled(
            pendingFiles.map((file) => projectDocumentService.upload(created.id, file)),
          )
          const failed = results.filter((r) => r.status === 'rejected').length
          if (failed > 0) {
            setDocUploadWarning(
              `Project created, but ${failed} of ${pendingFiles.length} document(s) failed to upload.`,
            )
          }
          qc.invalidateQueries({ queryKey: ['project-documents', created.id] })
        }
      }
      setOpen(false)
      setPendingFiles([])
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  const period = (p: Project) => {
    const start = p.startDate ? formatDate(String(p.startDate)) : ''
    if (p.derivedStatus === 'ongoing') return start ? `${start} – Ongoing` : 'Ongoing'
    return [p.startDate, p.endDate].filter(Boolean).map((d) => formatDate(String(d))).join(' – ')
  }

  return (
    <>
      <PageHeader
        title="CSR Projects"
        action={canCreate && <PrimaryButton onClick={openAdd}>Add Project</PrimaryButton>}
      />

      {deleteError && (
        <p className="mb-4 rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{deleteError}</p>
      )}
      {docUploadWarning && (
        <p className="mb-4 rounded-xl bg-warning/10 px-4 py-2.5 text-sm text-warning">{docUploadWarning}</p>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" />
      </div>

      <div className="space-y-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm transition-colors hover:bg-ink/[0.02]"
          >
            <div className="min-w-0">
              <DocumentAttachments
                parentId={p.id}
                canWrite={canWrite}
                allowUpload={false}
                service={projectDocumentService}
                queryKey="project-documents"
              />
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-ink">{p.name}</h3>
                <StatusBadge status={p.status} />
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-muted">
                  {p.derivedStatus === 'ongoing' ? 'Ongoing' : 'Other than Ongoing'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                <span>Companies: <span className="text-ink/80">{companyNames(p.companyIds)}</span></span>
                {p.category && <span>Category: <span className="text-ink/80">{p.category}</span></span>}
                {p.location && <span>Location: <span className="text-ink/80">{p.location}</span></span>}
                <span>Budget: <span className="text-ink/80">{formatINR(p.budget)}</span></span>
                {(p.startDate || p.endDate) && (
                  <span>Period: <span className="text-ink/80">{period(p)}</span></span>
                )}
              </div>
              {p.description && <p className="mt-1 line-clamp-2 text-sm text-primary">{p.description}</p>}
              {p.notes && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => setViewing(p)}
                className="text-muted hover:text-primary"
                title="View details, description & notes"
              >
                <Eye size={16} />
              </button>
              {canWrite && (
                <>
                  <button onClick={() => openEdit(p)} className="text-muted hover:text-primary" title="Edit project">
                    <Pencil size={16} />
                  </button>
                  {p.status === 'active' ? (
                    // Active projects are protected — enforced on the backend too.
                    <button
                      disabled
                      title="Active projects can't be deleted. Mark it Completed first."
                      className="cursor-not-allowed text-muted/40"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setDeleteError(''); setDeleteId(p.id) }}
                      className="text-muted hover:text-danger"
                      title="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No projects match the filters.</p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Project' : 'Add Project'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Project Name">
            <TextInput required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Companies &amp; Commitments *</span>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface/60 p-3">
              {companies.length === 0 && <p className="text-sm text-muted">No companies yet.</p>}
              {companies.map((c) => {
                const checked = form.companyIds.includes(c.id)
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-1">
                    <Checkbox checked={checked} onChange={(v) => toggleCompany(c.id, v)} label={c.name} />
                    {checked && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-xs text-muted">₹</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={form.amounts[c.id] ?? ''}
                          onChange={(e) => setCommitment(c.id, e.target.value)}
                          className="w-36 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-muted">
              How much each company has committed to this project. The Approved Budget below fills in from
              their total. What each has actually paid comes from its Fund Receipts.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status">
              <FormSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </FormSelect>
            </Field>
            <Field label="Derived Status">
              <FormSelect value={form.derivedStatus} onChange={(e) => setDerivedStatus(e.target.value as DerivedStatus)}>
                <option value="ongoing">Ongoing</option>
                <option value="other">Other than Ongoing</option>
              </FormSelect>
            </Field>
            <div>
              <Field label="Approved Budget (₹)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => {
                    setBudgetDirty(true)
                    setForm({ ...form, budget: e.target.value })
                  }}
                />
              </Field>
              {committedSum > 0 && budgetGap !== 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>Commitments total {formatINR(committedSum)}</span>
                  <span className="text-warning">
                    · {budgetGap > 0 ? 'Shortfall' : 'Excess'} {formatINR(Math.abs(budgetGap))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBudgetDirty(false)}
                    className="font-medium text-primary hover:underline"
                  >
                    Reset to total
                  </button>
                </p>
              )}
            </div>
            <Field label="Category">
              <FormSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {categoryOptions.map((c) => <option key={c.id} value={c.value}>{c.value}</option>)}
                {form.category && !categoryOptions.some((c) => c.value === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
              </FormSelect>
            </Field>
            <Field label="Location">
              <TextInput placeholder="City, State" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Start Date *">
              <DatePicker required maxDate="today" value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} />
            </Field>
            <Field label="End Date (auto)">
              <TextInput value={endDatePreview ? formatDate(endDatePreview) : '—'} readOnly disabled />
            </Field>
          </div>
          {REASON_REQUIRED.includes(form.status) && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              A description or notes entry is required for {form.status === 'on_hold' ? 'On Hold' : 'Cancelled'} projects.
            </p>
          )}
          <Field label="Attach Document">
            {editing ? (
              <DocumentAttachments
                parentId={editing.id}
                canWrite={canWrite}
                allowUpload
                service={projectDocumentService}
                queryKey="project-documents"
              />
            ) : (
              <StagedAttachments files={pendingFiles} setFiles={setPendingFiles} />
            )}
          </Field>
          <Field label="Description">
            <TextArea rows={3} placeholder="Project description…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Notes">
            <TextArea rows={2} placeholder="Additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {editing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing?.name ?? 'Project'}
        extra={viewing && <CommitmentTable project={viewing} receipts={receipts} companyName={companyName} />}
        rows={
          viewing
            ? [
                { label: 'Companies', value: companyNames(viewing.companyIds) },
                { label: 'Status', value: <StatusBadge status={viewing.status} /> },
                { label: 'Derived Status', value: viewing.derivedStatus === 'ongoing' ? 'Ongoing' : 'Other than Ongoing' },
                { label: 'Budget', value: formatINR(viewing.budget) },
                { label: 'Category', value: viewing.category },
                { label: 'Location', value: viewing.location },
                { label: 'Period', value: period(viewing) },
                { label: 'Created By', value: viewing.createdByName || viewing.createdByEmail },
              ]
            : []
        }
        sections={
          viewing
            ? [
                { label: 'Description', value: viewing.description },
                { label: 'Notes', value: viewing.notes },
              ]
            : []
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete project?"
        message="This will permanently remove the project."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}

