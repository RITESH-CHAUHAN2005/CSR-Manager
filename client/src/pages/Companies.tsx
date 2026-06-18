import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Mail, Phone, User } from '../components/icons'
import { companyService, analyticsService } from '../services/dataService'
import type { Company } from '../types'
import { formatINR } from '../lib/currency'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  TextInput,
} from '../components/ui'

const empty: Omit<Company, 'id'> = { name: '', cin: '', contactPerson: '', email: '', phone: '' }

export default function Companies() {
  const { canWrite } = useAuth()
  const qc = useQueryClient()
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: positions = [] } = useQuery({
    queryKey: ['company-positions'],
    queryFn: analyticsService.companyPositions,
  })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(empty)
  const [details, setDetails] = useState<Company | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) =>
      [c.name, c.cin, c.contactPerson, c.email].some((f) => f.toLowerCase().includes(q)),
    )
  }, [companies, search])

  const posById = useMemo(
    () => Object.fromEntries(positions.map((p) => [p.companyId, p])),
    [positions],
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['companies'] })
    qc.invalidateQueries({ queryKey: ['company-positions'] })
  }
  const createM = useMutation({ mutationFn: companyService.create, onSuccess: invalidate })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<Company> }) => companyService.update(v.id, v.data),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({ mutationFn: companyService.remove, onSuccess: invalidate })

  function openAdd() {
    setEditing(null)
    setForm(empty)
    setFormError('')
    setFormOpen(true)
  }
  function openEdit(c: Company) {
    setEditing(c)
    setForm({ name: c.name, cin: c.cin, contactPerson: c.contactPerson, email: c.email, phone: c.phone })
    setFormError('')
    setFormOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    try {
      if (editing) await updateM.mutateAsync({ id: editing.id, data: form })
      else await createM.mutateAsync(form)
      setFormOpen(false)
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Donor Companies"
        action={canWrite && <PrimaryButton onClick={openAdd}>Add Company</PrimaryButton>}
      />

      <div className="mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies…" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const p = posById[c.id]
          return (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
                <p className="text-xs uppercase tracking-wide text-slate-400">{c.cin}</p>
              </div>

              <div className="space-y-1.5 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" /> {c.contactPerson}
                </p>
                <p className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" /> {c.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" /> {c.phone}
                </p>
              </div>

              <div className="my-4 grid grid-cols-2 gap-y-3 border-t border-slate-100 pt-4 text-sm">
                <Stat label="Received" value={formatINR(p?.totalReceived ?? 0)} />
                <Stat label="Balance" value={formatINR(p?.balance ?? 0)} valueClass="text-success" />
                <Stat label="Projects" value={String(p?.projects ?? 0)} />
                <Stat
                  label="Expenditure"
                  value={formatINR(p?.expenditure ?? 0)}
                  valueClass="text-danger"
                />
              </div>

              <button
                onClick={() => setDetails(c)}
                className="mt-auto flex items-center justify-between rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                View Details <ChevronRight size={16} />
              </button>

              {canWrite && (
                <div className="mt-2 flex justify-end gap-3 text-xs">
                  <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-primary">
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="text-slate-500 hover:text-danger"
                  >
                    Delete
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Add / Edit form */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Company' : 'Add Company'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company Name">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="CIN / Registration No.">
            <TextInput required value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} />
          </Field>
          <Field label="Contact Person">
            <TextInput required value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </Field>
          <Field label="Email">
            <TextInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {editing ? 'Save Changes' : 'Add Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details */}
      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name ?? ''}>
        {details && (
          <div className="space-y-3 text-sm">
            <DetailRow label="CIN" value={details.cin} />
            <DetailRow label="Contact Person" value={details.contactPerson} />
            <DetailRow label="Email" value={details.email} />
            <DetailRow label="Phone" value={details.phone} />
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <DetailRow label="Total Received" value={formatINR(posById[details.id]?.totalReceived ?? 0)} />
              <DetailRow label="Carry Forward" value={formatINR(posById[details.id]?.carryForward ?? 0)} />
              <DetailRow label="Expenditure" value={formatINR(posById[details.id]?.expenditure ?? 0)} />
              <DetailRow label="Balance" value={formatINR(posById[details.id]?.balance ?? 0)} />
              <DetailRow label="Projects" value={String(posById[details.id]?.projects ?? 0)} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete company?"
        message="This will permanently remove the company."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}

function Stat({ label, value, valueClass = 'text-slate-900' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  )
}
