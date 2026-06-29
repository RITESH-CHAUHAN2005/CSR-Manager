import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from '../components/icons'
import {
  companyService,
  expenditureService,
  financialYearService,
  projectService,
} from '../services/dataService'
import type { Expenditure } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  ConfirmDialog,
  DatePicker,
  Field,
  FormSelect,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  Select,
  TextInput,
} from '../components/ui'

const CATEGORIES = ['Infrastructure', 'Training', 'Equipment', 'Scholarships', 'Environment']
const APPROVERS = ['Trustee Board', 'Executive Director']
const emptyForm = {
  date: '',
  projectId: '',
  companyId: '',
  financialYearId: '',
  category: 'Infrastructure',
  approvedBy: 'Trustee Board',
  amount: 0,
}

export default function Expenditures() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })

  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expenditure | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—'
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenditures.filter(
      (e) =>
        (!companyFilter || e.companyId === companyFilter) &&
        (!yearFilter || e.financialYearId === yearFilter) &&
        (!q ||
          [e.category, e.approvedBy, projectName(e.projectId), companyName(e.companyId)].some((f) =>
            f.toLowerCase().includes(q),
          )),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenditures, companyFilter, yearFilter, search, projects, companies])
  const total = filtered.reduce((s, e) => s + e.amount, 0)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenditures'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['company-positions'] })
  }
  const createM = useMutation({ mutationFn: (v: Omit<Expenditure, 'id'>) => expenditureService.create(v), onSuccess: invalidate })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<Expenditure> }) => expenditureService.update(v.id, v.data),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({ mutationFn: expenditureService.remove, onSuccess: invalidate })

  // Only active financial years can be chosen when adding. When editing (or when a
  // picked project belongs to a closed year), keep that year as an option too.
  const activeYears = useMemo(() => years.filter((y) => y.isActive), [years])
  const yearOptions = useMemo(() => {
    if (form.financialYearId && !activeYears.some((y) => y.id === form.financialYearId)) {
      const cur = years.find((y) => y.id === form.financialYearId)
      if (cur) return [cur, ...activeYears]
    }
    return activeYears
  }, [activeYears, years, form.financialYearId])

  // Selecting a project auto-fills its company and financial year (matches the data model).
  function pickProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId)
    setForm((f) => ({
      ...f,
      projectId,
      companyId: proj?.companyId ?? f.companyId,
      financialYearId: proj?.financialYearId ?? f.financialYearId,
    }))
  }

  function openAdd() {
    setEditing(null)
    const first = projects[0]
    setForm({
      ...emptyForm,
      projectId: first?.id ?? '',
      companyId: first?.companyId ?? '',
      financialYearId: first?.financialYearId ?? '',
    })
    setOpen(true)
  }
  function openEdit(e: Expenditure) {
    setEditing(e)
    setForm({ ...e })
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const payload = { ...form, amount: Number(form.amount) }
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
        title="Expenditures"
        subtitle={`${filtered.length} records — Total: ${formatINR(total)}`}
        action={canCreate && <PrimaryButton onClick={openAdd}>Record Expenditure</PrimaryButton>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </Select>
        <SearchInput value={search} onChange={setSearch} placeholder="Search expenditures…" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="sticky top-0 z-10 bg-surface/85 backdrop-blur border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Year</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Approved By</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              {canWrite && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink/[0.03]">
                <td className="px-5 py-3 text-ink/80">{formatDate(e.date)}</td>
                <td className="px-5 py-3 text-ink/80">{projectName(e.projectId)}</td>
                <td className="px-5 py-3 text-muted">{companyName(e.companyId)}</td>
                <td className="px-5 py-3 text-muted">{yearName(e.financialYearId)}</td>
                <td className="px-5 py-3 text-muted">{e.category}</td>
                <td className="px-5 py-3 text-muted">{e.approvedBy}</td>
                <td className="px-5 py-3 text-right font-semibold text-danger">{formatINR(e.amount)}</td>
                {canWrite && (
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => openEdit(e)} className="text-muted hover:text-primary"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteId(e.id)} className="text-muted hover:text-danger"><Trash2 size={16} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Expenditure' : 'Record Expenditure'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Project">
            <FormSelect required value={form.projectId} onChange={(e) => pickProject(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FormSelect>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date">
              <DatePicker required value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
            </Field>
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Category">
              <FormSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
            </Field>
            <Field label="Approved By">
              <FormSelect value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}>
                {APPROVERS.map((a) => <option key={a} value={a}>{a}</option>)}
              </FormSelect>
            </Field>
          </div>
          <Field label="Amount (₹)">
            <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">Cancel</button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">{editing ? 'Save Changes' : 'Record Expenditure'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete expenditure?"
        message="This will permanently remove the expenditure."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
