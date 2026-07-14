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
  projectService,
} from '../services/dataService'
import type { CapitalAsset, Expenditure, FundingRoute, NatureOfExpense } from '../types'
import { formatDate, formatINR } from '../lib/currency'
import { NATURE_OPTIONS, ROUTE_LABELS, ROUTE_OPTIONS, assetLocation, natureLabel } from '../lib/expenseLabels'
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

const emptyAsset: CapitalAsset = {
  particulars: '',
  address: '',
  district: '',
  state: '',
  pinCode: '',
  dateOfCreation: '',
}

const emptyForm = {
  date: '',
  projectId: '',
  companyId: '',
  financialYearId: '',
  amount: '' as number | string,
  natureOfExpense: 'project_intervention' as NatureOfExpense,
  otherNature: '',
  capitalAsset: { ...emptyAsset },
  fundingRoute: 'direct' as FundingRoute,
  approvedBy: '',
  description: '',
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export default function Expenditures() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })

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

  const project = (id: string) => projects.find((p) => p.id === id)
  const projectName = (id: string) => project(id)?.name ?? '—'
  const projectCode = (id: string) => project(id)?.projectCode || '—'
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenditures.filter(
      (e) =>
        (!companyFilter || e.companyId === companyFilter) &&
        (!yearFilter || e.financialYearId === yearFilter) &&
        (!q ||
          [
            projectCode(e.projectId),
            projectName(e.projectId),
            companyName(e.companyId),
            natureLabel(e),
            e.approvedBy,
          ].some((f) => (f ?? '').toLowerCase().includes(q))),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenditures, companyFilter, yearFilter, search, projects, companies])
  const total = sum(filtered.map((e) => e.amount))

  const dateCell = (d: unknown, type: string) => (type === 'display' ? formatDate(String(d)) : d)
  const rows = filtered.map((e) => ({
    ...e,
    projectCode: projectCode(e.projectId),
    projectName: projectName(e.projectId),
    companyName: companyName(e.companyId),
    yearName: yearName(e.financialYearId),
    natureName: natureLabel(e),
    routeName: ROUTE_LABELS[e.fundingRoute] ?? e.fundingRoute,
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

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.projectId),
    [projects, form.projectId],
  )

  // Picking a project shows exactly where that project's money stands, per company:
  // what each put in, what has already been spent, and what is left. The Company field
  // is narrowed to these companies, so an expenditure can only be booked against a
  // company that is actually on the project.
  const projectPosition = useMemo(() => {
    if (!selectedProject) return []
    const ids = new Set(selectedProject.companyIds ?? [])
    receipts.filter((r) => r.projectId === selectedProject.id && r.companyId).forEach((r) => ids.add(r.companyId!))
    expenditures.filter((e) => e.projectId === selectedProject.id).forEach((e) => ids.add(e.companyId))

    return [...ids].map((cid) => {
      const received = sum(
        receipts.filter((r) => r.projectId === selectedProject.id && r.companyId === cid).map((r) => r.amount),
      )
      const spent = sum(
        expenditures
          .filter((e) => e.projectId === selectedProject.id && e.companyId === cid && e.id !== editing?.id)
          .map((e) => e.amount),
      )
      return { companyId: cid, name: companyName(cid), received, spent, remaining: received - spent }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, receipts, expenditures, companies, editing])

  const selectedPosition = projectPosition.find((p) => p.companyId === form.companyId)
  // What this entry leaves behind on an Ongoing project — the carry-forward figure,
  // computed rather than typed. Nobody keys a carry-forward amount in any more.
  const carryForwardAfter = selectedPosition
    ? Math.max(0, selectedPosition.remaining - (Number(form.amount) || 0))
    : 0
  const overspend = selectedPosition
    ? (Number(form.amount) || 0) - selectedPosition.remaining
    : 0

  function pickProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId)
    const ids = proj?.companyIds ?? []
    setForm((f) => ({
      ...f,
      projectId,
      companyId: ids.length === 1 ? ids[0] : ids.includes(f.companyId) ? f.companyId : '',
      // A spend can only be routed through a partner the project actually names.
      fundingRoute: proj?.interventionPartner ? f.fundingRoute : 'direct',
    }))
  }

  function setAsset(patch: Partial<CapitalAsset>) {
    setForm((f) => ({ ...f, capitalAsset: { ...f.capitalAsset, ...patch } }))
  }

  function openAdd() {
    setEditing(null)
    const first = projects[0]
    const ids = first?.companyIds ?? []
    setForm({
      ...emptyForm,
      capitalAsset: { ...emptyAsset },
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
    setForm({
      ...emptyForm,
      ...e,
      capitalAsset: { ...emptyAsset, ...(e.capitalAsset ?? {}) },
    })
    setPendingFiles([])
    setFormError('')
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const isCapital = form.natureOfExpense === 'capital_asset'
    const payload = {
      ...form,
      amount: Number(form.amount),
      otherNature: form.natureOfExpense === 'other' ? form.otherNature.trim() : '',
      // Asset details only travel with a Capital Asset — otherwise they'd linger as
      // stale text on an entry that has no asset.
      capitalAsset: isCapital ? form.capitalAsset : { ...emptyAsset },
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search by Project ID, project, company…" />
      </div>

      <Card className="p-2 sm:p-4">
        <DataTable
          data={rows}
          columns={[
            { data: 'projectCode', title: 'Project ID' },
            { data: 'date', title: 'Date of Spend', render: dateCell },
            { data: 'projectName', title: 'Project' },
            { data: 'companyName', title: 'Company' },
            { data: 'yearName', title: 'Year' },
            { data: 'natureName', title: 'Nature of Expense' },
            { data: 'routeName', title: 'Direct / Partner' },
            { data: 'amount', title: 'Amount Spent', className: 'text-right' },
            { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
          ]}
          slots={{
            0: (_v, row) => <span className="font-mono text-xs text-muted">{row.projectCode}</span>,
            7: (_v, row) => <span className="font-semibold text-danger">{formatINR((row as Expenditure).amount)}</span>,
            8: (_v, row) => (
              <div className="flex justify-end gap-3">
                <button onClick={() => setViewing(row as Expenditure)} className="text-muted hover:text-primary" title="View full details"><Eye size={16} /></button>
                {canWrite && (
                  <>
                    <button onClick={() => openEdit(row as Expenditure)} className="text-muted hover:text-primary" title="Edit"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId((row as Expenditure).id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ),
          }}
          options={{ searching: false, order: [[1, 'desc']] }}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? 'Edit Expenditure' : 'Record Expenditure'}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Project">
            <FormSelect required value={form.projectId} onChange={(e) => pickProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                </option>
              ))}
            </FormSelect>
          </Field>

          {/* Where this project's money stands, company by company. */}
          {projectPosition.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Already Spent</th>
                    <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {projectPosition.map((c) => (
                    <tr
                      key={c.companyId}
                      className={[
                        'border-t border-line/50',
                        c.companyId === form.companyId ? 'bg-primary/5' : '',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 text-right text-success">{formatINR(c.received)}</td>
                      <td className="px-3 py-2 text-right text-danger">{formatINR(c.spent)}</td>
                      <td className={['px-3 py-2 text-right font-semibold', c.remaining < 0 ? 'text-danger' : 'text-ink'].join(' ')}>
                        {formatINR(c.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name of the Company">
              {/* Narrowed to the selected project's companies. */}
              <FormSelect required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                <option value="">Select company</option>
                {projectPosition.map((c) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Financial Year">
              <FormSelect required value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })}>
                {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </FormSelect>
            </Field>
            <Field label="Amount Spent (₹)">
              <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date of Spend">
              <DatePicker required value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
            </Field>
            <Field label="Nature of Expense">
              <FormSelect
                value={form.natureOfExpense}
                onChange={(e) => setForm({ ...form, natureOfExpense: e.target.value as NatureOfExpense })}
              >
                {NATURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FormSelect>
            </Field>
            <Field label="Whether Direct or through Intervention Partner">
              <FormSelect
                value={form.fundingRoute}
                onChange={(e) => setForm({ ...form, fundingRoute: e.target.value as FundingRoute })}
              >
                {ROUTE_OPTIONS.map(([value, label]) => (
                  // A project with no Intervention Partner named on it has nobody to route through.
                  <option
                    key={value}
                    value={value}
                    disabled={value === 'intervention_partner' && !selectedProject?.interventionPartner}
                  >
                    {label}
                  </option>
                ))}
              </FormSelect>
            </Field>
          </div>

          {form.fundingRoute === 'intervention_partner' && selectedProject?.interventionPartner && (
            <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-xs text-muted">
              Routed through <span className="font-medium text-ink/80">{selectedProject.interventionPartner}</span>, the
              Intervention Partner named on this project.
            </p>
          )}
          {!selectedProject?.interventionPartner && (
            <p className="text-xs text-muted">
              This project has no Intervention Partner. Add one on the project to record a spend routed through a partner.
            </p>
          )}

          {form.natureOfExpense === 'other' && (
            <Field label="Specify the nature of the expense">
              <TextInput
                required
                placeholder="e.g. Furniture and fixtures"
                value={form.otherNature}
                onChange={(e) => setForm({ ...form, otherNature: e.target.value })}
              />
            </Field>
          )}

          {form.natureOfExpense === 'capital_asset' && (
            <div className="space-y-4 rounded-xl border border-line bg-surface/60 p-4">
              <p className="text-sm font-medium text-ink">Capital Asset</p>
              <Field label="Short particulars of the property or asset(s)">
                <TextInput
                  required
                  placeholder="e.g. 25 desktop computers and networking equipment"
                  value={form.capitalAsset.particulars}
                  onChange={(e) => setAsset({ particulars: e.target.value })}
                />
              </Field>
              <Field label="Complete address">
                <TextArea
                  required
                  rows={2}
                  placeholder="Where the asset physically sits"
                  value={form.capitalAsset.address}
                  onChange={(e) => setAsset({ address: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="District">
                  <TextInput required value={form.capitalAsset.district} onChange={(e) => setAsset({ district: e.target.value })} />
                </Field>
                <Field label="State">
                  <TextInput required value={form.capitalAsset.state} onChange={(e) => setAsset({ state: e.target.value })} />
                </Field>
                <Field label="PIN Code">
                  <TextInput
                    required
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="6 digits"
                    value={form.capitalAsset.pinCode}
                    onChange={(e) => setAsset({ pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  />
                </Field>
                <Field label="Date of creation">
                  <DatePicker
                    required
                    value={form.capitalAsset.dateOfCreation}
                    onChange={(iso) => setAsset({ dateOfCreation: iso })}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Carry forward is derived, never entered — this is what the entry leaves behind. */}
          {selectedProject?.derivedStatus === 'ongoing' && selectedPosition && (
            <div className="rounded-xl bg-ink/[0.03] px-4 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Carry Forward (auto)</p>
              {overspend > 0 ? (
                <p className="mt-1 text-danger">
                  This spend exceeds what {companyName(form.companyId)} has left on this project by{' '}
                  <span className="font-semibold">{formatINR(overspend)}</span>. Nothing would carry forward.
                </p>
              ) : (
                <p className="mt-1 text-ink/80">
                  After this entry, <span className="font-medium">{formatINR(carryForwardAfter)}</span> of{' '}
                  {companyName(form.companyId)}'s funds remain unspent on this Ongoing project and carry into the next
                  financial year.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Approved By">
              <TextInput placeholder="Name or designation" value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
            </Field>
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
          </div>
          <Field label="Description">
            <TextArea rows={3} placeholder="What was this expenditure for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        title={viewing ? `Expenditure — ${projectCode(viewing.projectId)}` : 'Expenditure'}
        rows={
          viewing
            ? [
                { label: 'Project ID', value: projectCode(viewing.projectId) },
                { label: 'Project', value: projectName(viewing.projectId) },
                { label: 'Name of the Company', value: companyName(viewing.companyId) },
                { label: 'Financial Year', value: yearName(viewing.financialYearId) },
                { label: 'Nature of Expense', value: natureLabel(viewing) },
                { label: 'Direct / Through Partner', value: ROUTE_LABELS[viewing.fundingRoute] ?? viewing.fundingRoute },
                { label: 'Amount Spent', value: <span className="font-semibold text-danger">{formatINR(viewing.amount)}</span> },
                { label: 'Date of Spend', value: viewing.date ? formatDate(viewing.date) : '' },
                ...(viewing.natureOfExpense === 'capital_asset'
                  ? [
                      { label: 'Asset Particulars', value: viewing.capitalAsset?.particulars },
                      { label: 'Asset Location', value: assetLocation(viewing) },
                      {
                        label: 'Asset Created On',
                        value: viewing.capitalAsset?.dateOfCreation
                          ? formatDate(viewing.capitalAsset.dateOfCreation)
                          : '',
                      },
                    ]
                  : []),
                { label: 'Approved By', value: viewing.approvedBy },
                { label: 'Recorded By', value: viewing.createdByName || viewing.createdByEmail },
              ]
            : []
        }
        sections={viewing ? [{ label: 'Description', value: viewing.description }] : []}
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
