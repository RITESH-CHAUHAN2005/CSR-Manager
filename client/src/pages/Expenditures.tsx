import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import { DataTable } from '../components/DataTable'
import { DocumentAttachments, StagedAttachments } from '../components/DocumentAttachments'
import {
  companyService,
  expenditureDocumentService,
  expenditureService,
  financialYearService,
  fundReceiptService,
  masterDataService,
  projectService,
} from '../services/dataService'
import type { Expenditure } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { contributionsForProject } from '../lib/projectContributions'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  Card,
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
  TextArea,
  TextInput,
} from '../components/ui'

const emptyForm = {
  date: '',
  projectId: '',
  companyId: '',
  financialYearId: '',
  amount: '' as number | string,
  // Only meaningful when the selected project is Ongoing.
  carryForwardAmount: '' as number | string,
  category: '',
  approvedBy: '',
  description: '',
  notes: '',
}

export default function Expenditures() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: masterData = [] } = useQuery({ queryKey: ['master-data'], queryFn: masterDataService.list })
  const categoryOptions = useMemo(() => masterData.filter((m) => m.type === 'category'), [masterData])

  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expenditure | null>(null)
  const [viewing, setViewing] = useState<Expenditure | null>(null)
  const [form, setForm] = useState(emptyForm)
  // Staged for a brand-new expenditure (no id yet) — uploaded once creation succeeds.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [docUploadWarning, setDocUploadWarning] = useState('')

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
            (f ?? '').toLowerCase().includes(q),
          )),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenditures, companyFilter, yearFilter, search, projects, companies])
  const total = filtered.reduce((s, e) => s + e.amount, 0)

  const dateCell = (d: unknown, type: string) => (type === 'display' ? formatDate(String(d)) : d)
  const rows = filtered.map((e) => ({
    ...e,
    projectName: projectName(e.projectId),
    companyName: companyName(e.companyId),
    yearName: yearName(e.financialYearId),
  }))

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

  // A project may now be linked to more than one company — selecting a project
  // narrows the Company field to that project's companies, auto-picking it when
  // there's only one. The financial year is chosen independently (projects no
  // longer carry one).
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId),
    [projects, form.projectId],
  )
  const projectCompanies = useMemo(() => {
    const ids = selectedProject?.companyIds ?? []
    return companies.filter((c) => ids.includes(c.id))
  }, [companies, selectedProject])
  // Reference info shown when a project is picked — who contributed what (derived
  // from Fund Receipts against this project), so recording/reporting expenditure
  // against it is easier.
  const projectContributions = useMemo(() => {
    if (!selectedProject) return []
    return contributionsForProject(selectedProject.id, receipts)
      .filter((c) => c.amount > 0)
      .map((c) => ({ name: companyName(c.companyId), amount: c.amount }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, receipts, companies])

  function pickProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId)
    const ids = proj?.companyIds ?? []
    setForm((f) => ({
      ...f,
      projectId,
      companyId: ids.length === 1 ? ids[0] : ids.includes(f.companyId) ? f.companyId : '',
      // Carry forward only ever applies to an Ongoing project.
      carryForwardAmount: proj?.derivedStatus === 'ongoing' ? f.carryForwardAmount : '',
    }))
  }

  function openAdd() {
    setEditing(null)
    const first = projects[0]
    const ids = first?.companyIds ?? []
    setForm({
      ...emptyForm,
      projectId: first?.id ?? '',
      companyId: ids.length === 1 ? ids[0] : '',
      financialYearId: activeYears[0]?.id ?? '',
    })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  function openEdit(e: Expenditure) {
    setEditing(e)
    setForm({ ...emptyForm, ...e })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const ongoing = selectedProject?.derivedStatus === 'ongoing'
    const payload = {
      ...form,
      amount: Number(form.amount),
      carryForwardAmount: ongoing ? Number(form.carryForwardAmount) : 0,
    }
    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, data: payload })
      } else {
        const created = await createM.mutateAsync(payload)
        if (pendingFiles.length > 0) {
          const results = await Promise.allSettled(
            pendingFiles.map((file) => expenditureDocumentService.upload(created.id, file)),
          )
          const failed = results.filter((r) => r.status === 'rejected').length
          if (failed > 0) {
            setDocUploadWarning(
              `Expenditure recorded, but ${failed} of ${pendingFiles.length} document(s) failed to upload.`,
            )
          }
          qc.invalidateQueries({ queryKey: ['expenditure-documents', created.id] })
        }
      }
      setOpen(false)
      setPendingFiles([])
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

      {docUploadWarning && (
        <p className="mb-4 rounded-xl bg-warning/10 px-4 py-2.5 text-sm text-warning">{docUploadWarning}</p>
      )}

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

      <Card className="p-2 sm:p-4">
        <DataTable
          data={rows}
          columns={[
            { data: 'date', title: 'Date', render: dateCell },
            { data: 'projectName', title: 'Project' },
            { data: 'companyName', title: 'Company' },
            { data: 'yearName', title: 'Year' },
            { data: 'category', title: 'Category' },
            { data: 'approvedBy', title: 'Approved By' },
            { data: 'amount', title: 'Amount', className: 'text-right' },
            { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
          ]}
          slots={{
            6: (_v, row) => <span className="font-semibold text-danger">{formatINR((row as Expenditure).amount)}</span>,
            7: (_v, row) => (
              <div className="flex justify-end gap-3">
                <button onClick={() => setViewing(row as Expenditure)} className="text-muted hover:text-primary" title="View details, description & notes"><Eye size={16} /></button>
                {canWrite && (
                  <>
                    <button onClick={() => openEdit(row as Expenditure)} className="text-muted hover:text-primary" title="Edit"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId((row as Expenditure).id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ),
          }}
          options={{ searching: false, order: [[0, 'desc']] }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Expenditure' : 'Record Expenditure'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Project">
            <FormSelect required value={form.projectId} onChange={(e) => pickProject(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FormSelect>
          </Field>
          {projectContributions.length > 0 && (
            <div className="rounded-xl bg-ink/[0.03] px-3 py-2.5 text-xs text-muted">
              <p className="mb-1 font-medium uppercase tracking-wide">Contributing Companies</p>
              {projectContributions.map((c) => (
                <p key={c.name}>{c.name}: <span className="text-ink/80">{formatINR(c.amount)}</span></p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company">
              {/* Narrowed to the selected project's linked companies. */}
              <FormSelect required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                {projectCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Amount (₹)">
              <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date">
              <DatePicker required value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
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
            <Field label="Approved By">
              <TextInput placeholder="Name or designation" value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
            </Field>
            {selectedProject?.derivedStatus === 'ongoing' && (
              <Field label="Carry Forward Amount (₹)">
                <TextInput
                  type="number"
                  min={0}
                  value={form.carryForwardAmount}
                  onChange={(e) => setForm({ ...form, carryForwardAmount: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Attach Document">
            {editing ? (
              <DocumentAttachments
                parentId={editing.id}
                canWrite={canWrite}
                allowUpload
                service={expenditureDocumentService}
                queryKey="expenditure-documents"
              />
            ) : (
              <StagedAttachments files={pendingFiles} setFiles={setPendingFiles} />
            )}
          </Field>
          <Field label="Description">
            <TextArea rows={3} placeholder="What was this expenditure for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Notes">
            <TextArea rows={2} placeholder="Additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">Cancel</button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">{editing ? 'Save Changes' : 'Record'}</button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Expenditure — ${projectName(viewing.projectId)}` : 'Expenditure'}
        rows={
          viewing
            ? [
                { label: 'Date', value: viewing.date ? formatDate(viewing.date) : '' },
                { label: 'Financial Year', value: yearName(viewing.financialYearId) },
                { label: 'Project', value: projectName(viewing.projectId) },
                { label: 'Company', value: companyName(viewing.companyId) },
                { label: 'Category', value: viewing.category },
                { label: 'Approved By', value: viewing.approvedBy },
                { label: 'Amount', value: <span className="font-semibold text-danger">{formatINR(viewing.amount)}</span> },
                ...(viewing.carryForwardAmount
                  ? [{ label: 'Carry Forward Amount', value: formatINR(viewing.carryForwardAmount) }]
                  : []),
                { label: 'Recorded By', value: viewing.createdByName || viewing.createdByEmail },
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
