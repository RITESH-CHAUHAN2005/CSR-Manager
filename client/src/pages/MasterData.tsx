import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from '../components/icons'
import { ExportButtons } from '../components/ExportButtons'
import { masterDataService } from '../services/dataService'
import type { MasterDataItem, MasterDataType } from '../types'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import {
  Card,
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  PrimaryButton,
  TextArea,
  TextInput,
} from '../components/ui'

const TABS: { value: MasterDataType; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
]

export default function MasterData() {
  const { canWrite } = useAuth()
  const qc = useQueryClient()
  const { data: items = [] } = useQuery({ queryKey: ['master-data'], queryFn: masterDataService.list })

  const [tab, setTab] = useState<MasterDataType>('category')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MasterDataItem | null>(null)
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const rows = useMemo(() => items.filter((i) => i.type === tab), [items, tab])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['master-data'] })
  const createM = useMutation({
    mutationFn: (v: Omit<MasterDataItem, 'id'>) => masterDataService.create(v),
    onSuccess: invalidate,
  })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Partial<MasterDataItem> }) => masterDataService.update(v.id, v.data),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({ mutationFn: masterDataService.remove, onSuccess: invalidate })

  function openAdd() {
    setEditing(null)
    setValue('')
    setDescription('')
    setFormError('')
    setOpen(true)
  }
  function openEdit(item: MasterDataItem) {
    setEditing(item)
    setValue(item.value)
    setDescription(item.description ?? '')
    setFormError('')
    setOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, data: { type: editing.type, value, description } })
      } else {
        await createM.mutateAsync({ type: tab, value, description })
      }
      setOpen(false)
    } catch (err) {
      setFormError(getErrorMessage(err))
    }
  }

  const activeTab = TABS.find((t) => t.value === tab)!

  // Every master-data value, across all tabs — the export is the whole list, not the
  // section currently on screen.
  const masterDataCsv = {
    filename: 'master-data',
    headers: ['Type', 'Value', 'Description'],
    rows: items.map((m) => [m.type, m.value, m.description || '—']) as (string | number)[][],
  }

  return (
    <>
      <PageHeader
        title="Master Data"
        subtitle="Manage the value lists used as dropdowns across the app"
        action={
          <div className="flex flex-wrap gap-3">
            <ExportButtons entity="master-data" csv={masterDataCsv} />
            {canWrite && <PrimaryButton onClick={openAdd}>Add {activeTab.label}</PrimaryButton>}
          </div>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={[
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.value ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-2 sm:p-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No {activeTab.label.toLowerCase()} values yet.</p>
        ) : (
          <div className="divide-y divide-line/60">
            {rows.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 px-2 py-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">{item.value}</span>
                  {item.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                  )}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-3">
                    <button onClick={() => openEdit(item)} className="text-muted hover:text-primary" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="text-muted hover:text-danger" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${activeTab.label}` : `Add ${activeTab.label}`}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Value">
            <TextInput
              required
              maxLength={80}
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={5}
              maxLength={2000}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              {editing ? 'Save Changes' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={`Delete this ${activeTab.label.toLowerCase()}?`}
        message="This will permanently remove the value. Records already using it keep their existing value."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteM.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
