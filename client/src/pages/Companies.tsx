import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2 } from '../components/icons'
import { DataTable } from '../components/DataTable'
import { companyService } from '../services/dataService'
import type { Company } from '../types'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchInput,
  TextArea,
  TextInput,
} from '../components/ui'

// Blank optional fields read as an em dash rather than an empty cell, while the
// underlying value is left untouched for sorting/searching.
const dash = (v: unknown, type: string) => (type === 'display' ? (v ? String(v) : '—') : v)

const empty: Omit<Company, 'id'> = {
  name: '',
  cin: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
}

export default function Companies() {
  const { canWrite } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) =>
      [c.name, c.cin, c.contactPerson, c.email].some((f) => (f ?? '').toLowerCase().includes(q)),
    )
  }, [companies, search])

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
    setForm({
      name: c.name,
      cin: c.cin ?? '',
      contactPerson: c.contactPerson ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
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
        subtitle={`${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
        action={canWrite && <PrimaryButton onClick={openAdd}>Add Company</PrimaryButton>}
      />

      <div className="mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies…" />
      </div>

      <DataTable
        data={filtered}
        columns={[
          { data: 'name', title: 'Company Name' },
          { data: 'cin', title: 'CIN', render: dash },
          { data: 'contactPerson', title: 'Contact Person', render: dash },
          { data: 'email', title: 'Email', render: dash },
          { data: 'phone', title: 'Phone', render: dash },
          { data: null, title: '', orderable: false, searchable: false, className: 'text-right' },
        ]}
        slots={{
          0: (_v, row) => (
            <button
              onClick={() => navigate(`/companies/${row.id}`)}
              className="text-left font-medium text-ink hover:text-primary hover:underline"
            >
              {row.name}
            </button>
          ),
          5: (_v, row) => (
            <div className="flex justify-end gap-3">
              <button onClick={() => navigate(`/companies/${row.id}`)} className="text-muted hover:text-primary" title="View details">
                <Eye size={16} />
              </button>
              {canWrite && (
                <>
                  <button onClick={() => openEdit(row)} className="text-muted hover:text-primary" title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => setDeleteId(row.id)} className="text-muted hover:text-danger" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ),
        }}
        options={{ searching: false, order: [[0, 'asc']] }}
      />

      {/* Add / Edit form */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Donor Company' : 'Add Donor Company'}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Company Name *">
            <TextInput
              required
              placeholder="Full legal name of company"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Registration / CIN Number">
            <TextInput
              placeholder="e.g. U72200MH2004PLC153930"
              value={form.cin}
              onChange={(e) => setForm({ ...form, cin: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact Person">
              <TextInput
                placeholder="Name"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                placeholder="+91-"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Email">
            <TextInput
              type="email"
              placeholder="csr@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <TextArea
              rows={2}
              placeholder="Registered address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <TextArea
              rows={2}
              placeholder="Any additional notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {editing ? 'Save Changes' : 'Add Company'}
            </button>
          </div>
        </form>
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

