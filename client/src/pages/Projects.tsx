import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import {
  companyService,
  financialYearService,
  masterDataService,
  projectDocumentService,
  projectService,
} from '../services/dataService'
import type { DerivedStatus, Project, ProjectStatus } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { findCurrentFinancialYear, previewProjectEndDate } from '../lib/financialYear'
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

const emptyForm = {
  name: '',
  companyIds: [] as string[],
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
  const categoryOptions = useMemo(() => masterData.filter((m) => m.type === 'category'), [masterData])

  const [companyFilter, setCompanyFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [viewing, setViewing] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  // Staged for a brand-new project (no id yet) — uploaded once creation succeeds.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [docUploadWarning, setDocUploadWarning] = useState('')

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const companyNames = (ids: string[] = []) => ids.map(companyName).join(', ') || '—'
  // The FY a project belongs to = the year its Start Date falls into. Derived here
  // (not read from the stored financialYearId) so it also shows for older projects
  // saved before the field existed. Server keeps the two in sync on every write.
  const fyName = (p: Project) => findCurrentFinancialYear(years, p.startDate || undefined)?.name ?? '—'

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
  // The FY the chosen Start Date falls into — shown read-only, auto-filled. The
  // server derives and stores the same value, so the user never types it.
  const fyPreview = useMemo(
    () => findCurrentFinancialYear(years, form.startDate || undefined)?.name ?? '',
    [years, form.startDate],
  )

  function setDerivedStatus(derivedStatus: DerivedStatus) {
    setForm((f) => ({ ...f, derivedStatus }))
  }

  function toggleCompany(id: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      companyIds: checked ? [...f.companyIds, id] : f.companyIds.filter((c) => c !== id),
    }))
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, companyIds: companies[0] ? [companies[0].id] : [] })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  function openEdit(p: Project) {
    setEditing(p)
    setForm({ ...emptyForm, ...p, companyIds: p.companyIds ?? [] })
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
    // The End Date is always derived server-side.
    const payload = { ...form, budget: Number(form.budget) || 0 }
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
                <span>FY: <span className="text-ink/80">{fyName(p)}</span></span>
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
            <span className="mb-1.5 block text-sm font-medium text-ink">Companies *</span>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line bg-surface/60 p-3">
              {companies.length === 0 && <p className="text-sm text-muted">No companies yet.</p>}
              {companies.map((c) => (
                <div key={c.id} className="py-1">
                  <Checkbox
                    checked={form.companyIds.includes(c.id)}
                    onChange={(v) => toggleCompany(c.id, v)}
                    label={c.name}
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              The companies funding this project. What each has actually paid comes from its Fund Receipts.
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
            <Field label="Approved Budget (₹)">
              <TextInput
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </Field>
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
            <Field label="Financial Year (auto)">
              <TextInput
                value={fyPreview || '—'}
                readOnly
                disabled
                title="Set automatically from the financial year your Start Date falls into."
              />
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
        title={viewing?.name ?? 'Project'}
        rows={
          viewing
            ? [
                { label: 'Companies', value: companyNames(viewing.companyIds) },
                { label: 'Status', value: <StatusBadge status={viewing.status} /> },
                { label: 'Derived Status', value: viewing.derivedStatus === 'ongoing' ? 'Ongoing' : 'Other than Ongoing' },
                { label: 'Financial Year', value: fyName(viewing) },
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

