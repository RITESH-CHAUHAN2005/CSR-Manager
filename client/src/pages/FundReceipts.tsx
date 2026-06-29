import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from '../components/icons'
import { DataTable } from '../components/DataTable'
import {
  companyService,
  financialYearService,
  fundReceiptService,
} from '../services/dataService'
import type { FundReceipt, PaymentMode } from '../types'
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

const MODES: PaymentMode[] = ['NEFT', 'RTGS', 'Cheque']
const emptyForm = {
  date: '',
  companyId: '',
  financialYearId: '',
  reference: '',
  mode: 'NEFT' as PaymentMode,
  carryForward: 0,
  amount: 0,
}

export default function FundReceipts() {
  const { canWrite, canCreate } = useAuth()
  const qc = useQueryClient()
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })

  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FundReceipt | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '—'
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return receipts.filter(
      (r) =>
        (!companyFilter || r.companyId === companyFilter) &&
        (!yearFilter || r.financialYearId === yearFilter) &&
        (!q ||
          [r.reference, r.mode, companyName(r.companyId)].some((f) => f.toLowerCase().includes(q))),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, companyFilter, yearFilter, search, companies])
  const total = filtered.reduce((s, r) => s + r.amount, 0)

  const money = (d: unknown, type: string) => (type === 'display' ? formatINR(Number(d)) : Number(d))
  const dateCell = (d: unknown, type: string) => (type === 'display' ? formatDate(String(d)) : d)
  const rows = filtered.map((r) => ({
    ...r,
    companyName: companyName(r.companyId),
    yearName: yearName(r.financialYearId),
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

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, companyId: companies[0]?.id ?? '', financialYearId: activeYears[0]?.id ?? '' })
    setFormError('')
    setOpen(true)
  }
  function openEdit(r: FundReceipt) {
    setEditing(r)
    setForm({ ...r })
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const payload = { ...form, amount: Number(form.amount), carryForward: Number(form.carryForward) }
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
        action={canCreate && <PrimaryButton onClick={openAdd}>Record Receipt</PrimaryButton>}
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
            { data: 'companyName', title: 'Company' },
            { data: 'yearName', title: 'Year' },
            { data: 'reference', title: 'Reference' },
            { data: 'mode', title: 'Mode' },
            { data: 'carryForward', title: 'Carry Forward', className: 'text-right', render: money },
            { data: 'amount', title: 'Amount', className: 'text-right' },
            { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
          ]}
          slots={{
            6: (_v, row) => <span className="font-semibold text-success">{formatINR((row as FundReceipt).amount)}</span>,
            7: (_v, row) =>
              canWrite ? (
                <div className="flex justify-end gap-3">
                  <button onClick={() => openEdit(row as FundReceipt)} className="text-muted hover:text-primary"><Pencil size={16} /></button>
                  <button onClick={() => setDeleteId((row as FundReceipt).id)} className="text-muted hover:text-danger"><Trash2 size={16} /></button>
                </div>
              ) : null,
          }}
          options={{ searching: false, order: [[0, 'desc']] }}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Receipt' : 'Record Receipt'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date">
              <DatePicker required value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
            </Field>
            <Field label="Reference">
              <TextInput required value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </Field>
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
            <Field label="Mode">
              <FormSelect value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentMode })}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </FormSelect>
            </Field>
            <Field label="Carry Forward (₹)">
              <TextInput type="number" min={0} value={form.carryForward} onChange={(e) => setForm({ ...form, carryForward: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Amount (₹)">
            <TextInput type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">Cancel</button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">{editing ? 'Save Changes' : 'Record Receipt'}</button>
          </div>
        </form>
      </Modal>

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
