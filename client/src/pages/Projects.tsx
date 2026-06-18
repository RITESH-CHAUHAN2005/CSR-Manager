import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from '../components/icons'
import {
  companyService,
  financialYearService,
  projectService,
} from '../services/dataService'
import type { Project, ProjectStatus } from '../types'
import { formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  ConfirmDialog,
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

const CATEGORIES = ['Education', 'Environment', 'Skill Development', 'Healthcare', 'Infrastructure']

const emptyForm = {
  name: '',
  companyId: '',
  financialYearId: '',
  category: 'Education',
  location: '',
  budget: 0,
  status: 'active' as ProjectStatus,
  description: '',
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
            f.toLowerCase().includes(q),
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
  const deleteM = useMutation({ mutationFn: projectService.remove, onSuccess: invalidate })

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, companyId: companies[0]?.id ?? '', financialYearId: years[0]?.id ?? '' })
    setFormError('')
    setOpen(true)
  }
  function openEdit(p: Project) {
    setEditing(p)
    setForm({ ...p })
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

  return (
    <>
      <PageHeader
        title="CSR Projects"
        action={canCreate && <PrimaryButton onClick={openAdd}>Add Project</PrimaryButton>}
      />

      <div className="mb-5 flex gap-3">
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
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                <span>Company: <span className="text-slate-700">{companyName(p.companyId)}</span></span>
                <span>Year: <span className="text-slate-700">{yearName(p.financialYearId)}</span></span>
                <span>Category: <span className="text-slate-700">{p.category}</span></span>
                <span>Location: <span className="text-slate-700">{p.location}</span></span>
                <span>Budget: <span className="text-slate-700">{formatINR(p.budget)}</span></span>
              </div>
              <p className="mt-1 text-sm text-primary">{p.description}</p>
            </div>
            {canWrite && (
              <div className="flex shrink-0 gap-3">
                <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-primary">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setDeleteId(p.id)} className="text-slate-400 hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No projects match the filters.</p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Project' : 'Add Project'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Project Name">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">
              <FormSelect required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Category">
              <FormSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
            </Field>
            <Field label="Status">
              <FormSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                <option value="active">active</option>
                <option value="completed">completed</option>
              </FormSelect>
            </Field>
            <Field label="Location">
              <TextInput required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Budget (₹)">
              <TextInput type="number" min={0} required value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Description">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {editing ? 'Save Changes' : 'Add Project'}
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
