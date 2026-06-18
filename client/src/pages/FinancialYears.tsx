import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Trash2 } from '../components/icons'
import { financialYearService } from '../services/dataService'
import type { FinancialYear } from '../types'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  ConfirmDialog,
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
          <Card key={fy.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                <CalendarDays size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{fy.name}</h3>
                  {fy.isActive && (
                    <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {fy.startDate} to {fy.endDate}
                </p>
              </div>
            </div>
            {canWrite && (
              <button onClick={() => setDeleteId(fy.id)} className="text-danger hover:opacity-70">
                <Trash2 size={18} />
              </button>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <TextInput type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End Date">
              <TextInput type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Mark as active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
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
