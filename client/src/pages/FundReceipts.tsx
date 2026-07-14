import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import { DataTable } from '../components/DataTable'
import { DocumentAttachments, StagedAttachments } from '../components/DocumentAttachments'
import {
  companyService,
  financialYearService,
  fundReceiptDocumentService,
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
  // Per-contributing-company amount and account number, keyed by company id — used
  // when a project is chosen and all of its companies are entered together in one go.
  // Every company banks from its own account, so the account number belongs on the
  // row, not on the form. Each row still becomes its own FundReceipt record.
  rows: {} as Record<string, string>,
  refs: {} as Record<string, string>,
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
  // Proof of payment staged for a brand-new receipt (no id yet) — uploaded once the
  // record(s) exist. A batch shares its proof: each receipt gets its own copy.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [docUploadWarning, setDocUploadWarning] = useState('')

  const companyName = (id?: string) => (id ? companies.find((c) => c.id === id)?.name ?? '—' : '—')
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'
  const projectName = (id?: string) => (id ? projects.find((p) => p.id === id)?.name ?? '—' : '—')
  const projectCode = (id?: string) => (id ? projects.find((p) => p.id === id)?.projectCode || '—' : '—')
  // What shows in the "Donor Company / Source" column. Every receipt carries a company;
  // an 'other_source' receipt additionally names where the income came from.
  const partyLabel = (r: FundReceipt) => {
    if (r.receiptType !== 'other_source') return companyName(r.companyId)
    const src = r.source || '—'
    return r.companyId ? `${src} — ${companyName(r.companyId)}` : src
  }

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId),
    [projects, form.projectId],
  )
  // The companies funding the chosen project — one entry row each.
  const projectRows = selectedProject?.companyIds ?? []
  // Picking a project turns the single Donor Company + Amount pair into one row per
  // contributing company. Editing stays single-record — a receipt is one receipt.
  const useGrid = !editing && form.receiptType === 'company' && projectRows.length > 0
  const gridTotal = projectRows.reduce((s, id) => s + (Number(form.rows[id]) || 0), 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return receipts.filter(
      (r) =>
        (!companyFilter || r.companyId === companyFilter) &&
        (!yearFilter || r.financialYearId === yearFilter) &&
        (!q ||
          [r.reference, partyLabel(r), projectCode(r.projectId), projectName(r.projectId)].some((f) =>
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
    projectCode: projectCode(r.projectId),
    projectName: projectName(r.projectId),
  }))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['fund-receipts'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['company-positions'] })
  }
  const createM = useMutation({ mutationFn: (v: Omit<FundReceipt, 'id'>) => fundReceiptService.create(v), onSuccess: invalidate })
  const createManyM = useMutation({
    mutationFn: (v: Omit<FundReceipt, 'id'>[]) => fundReceiptService.createMany(v),
    onSuccess: invalidate,
  })
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
      // Both receipt types belong to a company, so pre-select one either way.
      companyId: companies[0]?.id ?? '',
      source: receiptType === 'other_source' ? sourceOptions[0]?.value ?? '' : '',
      financialYearId: activeYears[0]?.id ?? '',
    })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }
  function openEdit(r: FundReceipt) {
    setEditing(r)
    setForm({ ...emptyForm, ...r })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }

  // Attaches the staged proof to every receipt the entry produced. Failures are
  // reported rather than thrown — the receipts themselves are already saved.
  async function uploadProof(receiptIds: string[]) {
    if (pendingFiles.length === 0) return
    const jobs = receiptIds.flatMap((id) => pendingFiles.map((file) => fundReceiptDocumentService.upload(id, file)))
    const failed = (await Promise.allSettled(jobs)).filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      setDocUploadWarning(`Receipt saved, but ${failed} of ${jobs.length} document(s) failed to upload.`)
    }
    receiptIds.forEach((id) => qc.invalidateQueries({ queryKey: ['fund-receipt-documents', id] }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setDocUploadWarning('')
    const { rows: gridRows, refs: gridRefs, ...base } = form
    const payload = {
      ...base,
      amount: Number(form.amount),
      // companyId is kept for BOTH types — an 'other_source' receipt records income
      // earned on a company's funds, so it still belongs to that company.
      source: form.receiptType === 'other_source' ? form.source : '',
    }
    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, data: payload })
      } else if (useGrid) {
        const receiptsToCreate = projectRows
          .filter((companyId) => Number(gridRows[companyId]) > 0)
          .map((companyId) => ({
            ...payload,
            companyId,
            amount: Number(gridRows[companyId]),
            reference: gridRefs[companyId]?.trim() ?? '',
          }))
        if (receiptsToCreate.length === 0) {
          setFormError('Enter an amount for at least one company.')
          return
        }
        const created = await createManyM.mutateAsync(receiptsToCreate)
        await uploadProof(created.map((r) => r.id))
      } else {
        const created = await createM.mutateAsync(payload)
        await uploadProof([created.id])
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search receipts…" />
      </div>

      <Card className="p-2 sm:p-4">
        <DataTable
          data={rows}
          columns={[
            { data: 'date', title: 'Date', render: dateCell },
            { data: 'partyLabel', title: 'Donor Company / Source' },
            { data: 'yearName', title: 'Year' },
            { data: 'projectCode', title: 'Project ID' },
            { data: 'projectName', title: 'Project' },
            { data: 'reference', title: 'Account Number' },
            { data: 'amount', title: 'Amount', className: 'text-right' },
            { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
          ]}
          slots={{
            3: (_v, row) => <span className="font-mono text-xs text-muted">{row.projectCode}</span>,
            6: (_v, row) => <span className="font-semibold text-success">{formatINR((row as FundReceipt).amount)}</span>,
            7: (_v, row) => (
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
        size={useGrid ? 'lg' : 'md'}
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
            {form.receiptType === 'other_source' && (
              <Field label="Source">
                <FormSelect required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="">Select source</option>
                  {sourceOptions.map((s) => <option key={s.id} value={s.value}>{s.value}</option>)}
                </FormSelect>
              </Field>
            )}
            {/* Hidden when a project drives the per-company grid — each row names its own company. */}
            {!useGrid && (
              <Field label={form.receiptType === 'other_source' ? 'Company' : 'Donor Company'}>
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
              <FormSelect
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value, rows: {}, refs: {} })}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                  </option>
                ))}
              </FormSelect>
            </Field>
            {!useGrid && (
              <Field label="Amount (₹)">
                <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
            )}
            <Field label="Receipt Date">
              <DatePicker required maxDate="today" value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
            </Field>
          </div>

          {useGrid && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">Amount Received (₹)</span>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 text-left font-medium">Company</th>
                      <th className="px-3 py-2 text-left font-medium">Account Number</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink">
                    {projectRows.map((companyId) => (
                      <tr key={companyId} className="border-t border-line/50">
                        <td className="px-3 py-2">{companyName(companyId)}</td>
                        <td className="px-3 py-2">
                          <input
                            placeholder="Bank account number"
                            value={form.refs[companyId] ?? ''}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, refs: { ...f.refs, [companyId]: e.target.value } }))
                            }
                            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={form.rows[companyId] ?? ''}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, rows: { ...f.rows, [companyId]: e.target.value } }))
                            }
                            className="w-32 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-right text-sm text-ink shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 flex justify-between text-xs text-muted">
                <span>Leave a company blank to skip it. Each amount is saved as its own receipt.</span>
                <span className="font-semibold text-success">Total {formatINR(gridTotal)}</span>
              </p>
            </div>
          )}
          {/* In grid mode every company banks from its own account, so the number lives on the row. */}
          {!useGrid && (
            <Field label="Account Number">
              <TextInput placeholder="Bank account number" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </Field>
          )}
          <Field label="Attach Proof">
            {editing ? (
              <DocumentAttachments
                parentId={editing.id}
                canWrite={canWrite}
                allowUpload
                service={fundReceiptDocumentService}
                queryKey="fund-receipt-documents"
              />
            ) : (
              <StagedAttachments files={pendingFiles} setFiles={setPendingFiles} />
            )}
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
        extra={
          viewing && (
            <div className="mt-5">
              <DocumentAttachments
                parentId={viewing.id}
                canWrite={false}
                allowUpload={false}
                service={fundReceiptDocumentService}
                queryKey="fund-receipt-documents"
              />
            </div>
          )
        }
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
                { label: 'Project ID', value: projectCode(viewing.projectId) },
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
