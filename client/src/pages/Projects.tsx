import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from '../components/icons'
import {
  companyService,
  financialYearService,
  projectService,
} from '../services/dataService'
import type { Project, ProjectStatus } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  ConfirmDialog,
  DatePicker,
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

const emptyForm = {
  name: '',
  companyId: '',
  financialYearId: '',
  status: 'active' as ProjectStatus,
  budget: 0,
  category: '',
  location: '',
  startDate: '',
  endDate: '',
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

  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(
      (p) =>
        (!companyFilter || p.companyId === companyFilter) &&
        (!yearFilter || p.financialYearId === yearFilter) &&
        (!q ||
          [p.name, p.category, p.location, p.description, companyName(p.companyId)].some((f) =>
            (f ?? '').toLowerCase().includes(q),
          )),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, companyFilter, yearFilter, search, companies])

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

  // Only active financial years can be chosen when adding. When editing, keep the
  // record's own (possibly inactive) year as an option so existing data stays intact.
  const activeYears = useMemo(() => years.filter((y) => y.isActive), [years])
  const yearOptions = useMemo(() => {
    if (form.financialYearId && !activeYears.some((y) => y.id === form.financialYearId)) {
      const cur = years.find((y) => y.id === form.financialYearId)
      if (cur) return [cur, ...activeYears]
    }
    return activeYears
  }, [activeYears, years, form.financialYearId])

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, companyId: companies[0]?.id ?? '', financialYearId: activeYears[0]?.id ?? '' })
    setFormError('')
    setOpen(true)
  }
  function openEdit(p: Project) {
    setEditing(p)
    setForm({ ...emptyForm, ...p })
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const payload = { ...form, budget: Number(form.budget) }
    try {
      if (editing) await updateM.mutateAsync({ id: editing.id, data: payload })
      else await createM.mutateAsync(payload)
      setOpen(false)
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  const period = (p: Project) =>
    [p.startDate, p.endDate].filter(Boolean).map((d) => formatDate(String(d))).join(' – ')

  return (
    <>
      <PageHeader
        title="CSR Projects"
        action={canCreate && <PrimaryButton onClick={openAdd}>Add Project</PrimaryButton>}
      />

      {deleteError && (
        <p className="mb-4 rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{deleteError}</p>
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
        <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
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
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-ink">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                <span>Company: <span className="text-ink/80">{companyName(p.companyId)}</span></span>
                <span>Year: <span className="text-ink/80">{yearName(p.financialYearId)}</span></span>
                {p.category && <span>Category: <span className="text-ink/80">{p.category}</span></span>}
                {p.location && <span>Location: <span className="text-ink/80">{p.location}</span></span>}
                <span>Budget: <span className="text-ink/80">{formatINR(p.budget)}</span></span>
                {(p.startDate || p.endDate) && (
                  <span>Period: <span className="text-ink/80">{period(p)}</span></span>
                )}
              </div>
              {p.description && <p className="mt-1 text-sm text-primary">{p.description}</p>}
              {p.notes && <p className="mt-1 text-sm text-muted">{p.notes}</p>}
            </div>
            {canWrite && (
              <div className="flex shrink-0 gap-3">
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
              </div>
            )}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company">
              <FormSelect required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Status">
              <FormSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </FormSelect>
            </Field>
            <Field label="Approved Budget (₹)">
              <TextInput type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            </Field>
            <Field label="Category">
              <TextInput placeholder="e.g. Education, Healthcare" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Location">
              <TextInput placeholder="City, State" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Start Date">
              <DatePicker value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} />
            </Field>
            <Field label="End Date">
              <DatePicker value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} />
            </Field>
          </div>
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
