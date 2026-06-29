import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Trash2 } from '../components/icons'
import { financialYearService } from '../services/dataService'
import type { FinancialYear } from '../types'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  ConfirmDialog,
  DatePicker,
  Field,
  Modal,
  PageHeader,
  PrimaryButton,
  TextInput,
} from '../components/ui'

const empty = { name: '', startDate: '', endDate: '', isActive: true }

export default function FinancialYears() {
  const { canWrite } = useAuth()
  const qc = useQueryClient()
  const { data: years = [] } = useQuery({
    queryKey: ['financial-years'],
    queryFn: financialYearService.list,
  })

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['financial-years'] })
  const createM = useMutation({
    mutationFn: (v: Omit<FinancialYear, 'id'>) => financialYearService.create(v),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({ mutationFn: financialYearService.remove, onSuccess: invalidate })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<FinancialYear> }) => financialYearService.update(v.id, v.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-years'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    createM.mutate(form)
    setOpen(false)
    setForm(empty)
  }

  return (
    <>
      <PageHeader
        title="Financial Years"
        action={canWrite && <PrimaryButton onClick={() => setOpen(true)}>Add Financial Year</PrimaryButton>}
      />

      <div className="space-y-4">
        {years.map((fy) => (
          <Card key={fy.id} className="lift flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <span className="text-muted">
                <CalendarDays size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink">{fy.name}</h3>
                  {fy.isActive && (
                    <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">
                  {fy.startDate} to {fy.endDate}
                </p>
              </div>
            </div>
            {canWrite && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted">{fy.isActive ? 'Active' : 'Inactive'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fy.isActive}
                  onClick={() => updateM.mutate({ id: fy.id, data: { name: fy.name, startDate: fy.startDate, endDate: fy.endDate, isActive: !fy.isActive } })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fy.isActive ? 'bg-primary' : 'bg-line'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fy.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <button onClick={() => setDeleteId(fy.id)} className="text-danger hover:opacity-70">
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Financial Year">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <TextInput
              required
              placeholder="FY 2025-26"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start Date">
              <DatePicker required value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} />
            </Field>
            <Field label="End Date">
              <DatePicker required value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Mark as active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              Add Financial Year
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete financial year?"
        message="This will permanently remove the financial year."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
