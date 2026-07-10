import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import { DataTable } from '../components/DataTable'
import {
  companyService,
  financialYearService,
  fundReceiptService,
  masterDataService,
  projectService,
} from '../services/dataService'
import type { FundReceipt, FundReceiptType } from '../types'
import { formatDate, formatINR } from '../lib/currency'
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
  receiptType: 'company' as FundReceiptType,
  companyId: '',
  source: '',
  financialYearId: '',
  projectId: '',
  amount: '' as number | string,
  reference: '',
  notes: '',
}

export default function FundReceipts() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: masterData = [] } = useQuery({ queryKey: ['master-data'], queryFn: masterDataService.list })
  const sourceOptions = useMemo(() => masterData.filter((m) => m.type === 'source'), [masterData])

  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FundReceipt | null>(null)
  const [viewing, setViewing] = useState<FundReceipt | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const companyName = (id?: string) => (id ? companies.find((c) => c.id === id)?.name ?? '—' : '—')
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'
  const projectName = (id?: string) => (id ? projects.find((p) => p.id === id)?.name ?? '—' : '—')
  // What shows in the "Donor Company / Source" column — depends on how the receipt was recorded.
  // An 'other_source' receipt can now optionally also be tagged to a company (e.g.
  // money received from a company before its project has started), so show both.
  const partyLabel = (r: FundReceipt) => {
    if (r.receiptType !== 'other_source') return companyName(r.companyId)
    const src = r.source || '—'
    return r.companyId ? `${src} — ${companyName(r.companyId)}` : src
  }

  // When the chosen project is linked to more than one company, a "which company"
  // helper appears below the Project field so the right Donor Company can be picked.
  const selectedProjectCompanies = useMemo(() => {
    const proj = projects.find((p) => p.id === form.projectId)
    return proj?.companyIds ?? []
  }, [projects, form.projectId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return receipts.filter(
      (r) =>
        (!companyFilter || r.companyId === companyFilter) &&
        (!yearFilter || r.financialYearId === yearFilter) &&
        (!q ||
          [r.reference, partyLabel(r), projectName(r.projectId)].some((f) =>
            (f ?? '').toLowerCase().includes(q),
          )),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, companyFilter, yearFilter, search, companies, projects])
  const total = filtered.reduce((s, r) => s + r.amount, 0)

  const dateCell = (d: unknown, type: string) => (type === 'display' ? formatDate(String(d)) : d)
  const rows = filtered.map((r) => ({
    ...r,
    partyLabel: partyLabel(r),
    yearName: yearName(r.financialYearId),
    projectName: projectName(r.projectId),
  }))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['fund-receipts'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['company-positions'] })
  }
  const createM = useMutation({ mutationFn: (v: Omit<FundReceipt, 'id'>) => fundReceiptService.create(v), onSuccess: invalidate })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<FundReceipt> }) => fundReceiptService.update(v.id, v.data),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({ mutationFn: fundReceiptService.remove, onSuccess: invalidate })

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

  function openAdd(receiptType: FundReceiptType) {
    setEditing(null)
    setForm({
      ...emptyForm,
      receiptType,
      companyId: receiptType === 'company' ? companies[0]?.id ?? '' : '',
      source: receiptType === 'other_source' ? sourceOptions[0]?.value ?? '' : '',
      financialYearId: activeYears[0]?.id ?? '',
    })
    setFormError('')
    setOpen(true)
  }
  function openEdit(r: FundReceipt) {
    setEditing(r)
    setForm({ ...emptyForm, ...r })
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const payload = {
      ...form,
      amount: Number(form.amount),
      // companyId is kept for BOTH types now — an 'other_source' receipt can
      // optionally tag which company it came from (e.g. before a project starts).
      source: form.receiptType === 'other_source' ? form.source : '',
    }
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
        title="Fund Receipts"
        subtitle={`${filtered.length} records — Total: ${formatINR(total)}`}
        action={
          canCreate && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => openAdd('other_source')}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-ink/5"
              >
                Receipt From Other Source
              </button>
              <PrimaryButton onClick={() => openAdd('company')}>Record Receipt</PrimaryButton>
            </div>
          )
        }
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search receipts…" />
      </div>

      <Card className="p-2 sm:p-4">
        <DataTable
          data={rows}
          columns={[
            { data: 'date', title: 'Date', render: dateCell },
            { data: 'partyLabel', title: 'Donor Company / Source' },
            { data: 'yearName', title: 'Year' },
            { data: 'projectName', title: 'Project' },
            { data: 'reference', title: 'Account Number' },
            { data: 'amount', title: 'Amount', className: 'text-right' },
            { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
          ]}
          slots={{
            5: (_v, row) => <span className="font-semibold text-success">{formatINR((row as FundReceipt).amount)}</span>,
            6: (_v, row) => (
              <div className="flex justify-end gap-3">
                <button onClick={() => setViewing(row as FundReceipt)} className="text-muted hover:text-primary" title="View details & notes"><Eye size={16} /></button>
                {canWrite && (
                  <>
                    <button onClick={() => openEdit(row as FundReceipt)} className="text-muted hover:text-primary" title="Edit"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId((row as FundReceipt).id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ),
          }}
          options={{ searching: false, order: [[0, 'desc']] }}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? 'Edit Receipt'
            : form.receiptType === 'other_source'
              ? 'Receipt From Other Source'
              : 'Record Fund Receipt'
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {form.receiptType === 'other_source' ? (
              <>
                <Field label="Source">
                  <FormSelect required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                    <option value="">Select source</option>
                    {sourceOptions.map((s) => <option key={s.id} value={s.value}>{s.value}</option>)}
                  </FormSelect>
                </Field>
                <Field label="Company (optional)">
                  <FormSelect value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                    <option value="">No company</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </FormSelect>
                  <p className="mt-1 text-xs text-muted">
                    Tag a company if this money is from them (e.g. received before their project has started).
                  </p>
                </Field>
              </>
            ) : (
              <Field label="Donor Company">
                <FormSelect required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </FormSelect>
              </Field>
            )}
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Project">
              <FormSelect value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FormSelect>
            </Field>
            {form.receiptType === 'company' && form.projectId && selectedProjectCompanies.length > 1 && (
              <Field label="Project's Contributing Company">
                <FormSelect value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                  <option value="">Select company</option>
                  {selectedProjectCompanies.map((cid) => (
                    <option key={cid} value={cid}>{companyName(cid)}</option>
                  ))}
                </FormSelect>
              </Field>
            )}
            <Field label="Amount (₹)">
              <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Receipt Date">
              <DatePicker required maxDate="today" value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
            </Field>
          </div>
          <Field label="Account Number">
            <TextInput placeholder="Bank account number" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
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
        title={viewing ? `Receipt — ${partyLabel(viewing)}` : 'Fund Receipt'}
        rows={
          viewing
            ? [
                { label: 'Date', value: viewing.date ? formatDate(viewing.date) : '' },
                { label: 'Financial Year', value: yearName(viewing.financialYearId) },
                ...(viewing.receiptType === 'other_source'
                  ? [
                      { label: 'Source', value: viewing.source },
                      ...(viewing.companyId ? [{ label: 'Company', value: companyName(viewing.companyId) }] : []),
                    ]
                  : [{ label: 'Donor Company', value: companyName(viewing.companyId) }]),
                { label: 'Project', value: projectName(viewing.projectId) },
                { label: 'Account Number', value: viewing.reference },
                { label: 'Amount', value: <span className="font-semibold text-success">{formatINR(viewing.amount)}</span> },
                { label: 'Recorded By', value: viewing.createdByName || viewing.createdByEmail },
              ]
            : []
        }
        sections={viewing ? [{ label: 'Notes', value: viewing.notes }] : []}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete receipt?"
        message="This will permanently remove the fund receipt."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
