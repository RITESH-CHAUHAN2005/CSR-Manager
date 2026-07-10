import {
  Children,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import flatpickr from 'flatpickr'
import type { Instance } from 'flatpickr/dist/types/instance'
import 'flatpickr/dist/flatpickr.min.css'
// jQuery must be global before Select2 attaches to $.fn.
import $ from '../lib/jquery-global'
import select2 from 'select2'
import 'select2/dist/css/select2.min.css'
import { Plus, Search, X } from './icons'

// Install the Select2 plugin onto jQuery ($.fn.select2). Calling the installer
// (rather than a bare side-effect import) prevents the bundler from tree-shaking it.
select2()

// ---------------- PageHeader ----------------
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------------- Buttons ----------------
export function PrimaryButton({
  children,
  icon = true,
  ...props
}: { children: ReactNode; icon?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-all duration-200 hover:bg-primary-dark hover:shadow-md hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
    >
      {icon && <Plus size={16} weight="bold" />}
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  ...props
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-ink shadow-sm backdrop-blur transition-all duration-200 hover:bg-ink/5 active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  ...props
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-danger/25 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// ---------------- StatusBadge ----------------
const STATUS_LABELS: Record<string, string> = {
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-success/15 text-success ring-success/20',
    completed: 'bg-primary/15 text-primary ring-primary/20',
    on_hold: 'bg-warning/15 text-warning ring-warning/25',
    cancelled: 'bg-danger/15 text-danger ring-danger/20',
    approved: 'bg-success/15 text-success ring-success/20',
    pending: 'bg-warning/15 text-warning ring-warning/25',
    rejected: 'bg-danger/15 text-danger ring-danger/20',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        styles[status] ?? 'bg-ink/10 text-muted ring-ink/10'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ---------------- Select2-backed dropdown ----------------
// A jQuery Select2 widget that keeps the same (value / onChange / <option> children)
// contract the pages already use, so every dropdown becomes a rounded, searchable,
// theme-aware control without touching call sites.
function Select2Base({
  value,
  onChange,
  children,
  containerClassName = '',
}: {
  value?: string | number | readonly string[]
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
  children: ReactNode
  containerClassName?: string
}) {
  const ref = useRef<HTMLSelectElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Signature of the current <option>s — re-init Select2 when they change (async loads).
  const optionsSig = useMemo(
    () =>
      Children.toArray(children)
        .map((c) => {
          const p = (c as { props?: { value?: unknown; children?: unknown } }).props
          return `${String(p?.value)}:${typeof p?.children === 'string' ? p?.children : ''}`
        })
        .join('|'),
    [children],
  )

  function bind() {
    const el = ref.current
    if (!el) return
    const $el = $(el) as unknown as {
      select2: (opt?: unknown) => void
      on: (ev: string, cb: () => void) => void
    }
    ;(($el as unknown) as { select2: (o: unknown) => void }).select2({
      width: '100%',
      minimumResultsForSearch: 8,
      dropdownCssClass: 'csr-select2-dropdown',
    })
    $el.on('change', () => {
      onChangeRef.current?.({ target: { value: el.value } } as unknown as ChangeEvent<HTMLSelectElement>)
    })
  }
  function unbind() {
    const el = ref.current
    if (!el) return
    const $el = $(el) as unknown as { select2: (a: string) => void; off: (e: string) => void; data: (k: string) => unknown }
    try {
      if ($el.data('select2')) {
        $el.off('change')
        $el.select2('destroy')
      }
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    bind()
    return unbind
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-init when the option set changes so the list reflects the latest data.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const $el = $(el) as unknown as { data: (k: string) => unknown; trigger: (e: string) => void }
    if ($el.data('select2')) {
      unbind()
      bind()
      if (value !== undefined) {
        el.value = String(value)
        $el.trigger('change.select2')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsSig])

  // Sync controlled value into Select2 without firing onChange.
  useEffect(() => {
    const el = ref.current
    if (!el || value === undefined) return
    if (el.value !== String(value)) {
      el.value = String(value)
      ;($(el) as unknown as { trigger: (e: string) => void }).trigger('change.select2')
    }
  }, [value, optionsSig])

  return (
    <div className={`csr-select2 ${containerClassName}`}>
      <select ref={ref} defaultValue={value as string}>
        {children}
      </select>
    </div>
  )
}

// Filter-style dropdown (used in page toolbars).
export function Select({ children, value, onChange }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Select2Base value={value} onChange={onChange} containerClassName="w-full sm:w-52">
      {children}
    </Select2Base>
  )
}

// ---------------- SearchInput ----------------
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-full sm:w-auto">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface/70 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-muted shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 sm:w-64"
      />
    </div>
  )
}

// ---------------- Card (glassmorphism) ----------------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-card rounded-2xl ${className}`}>{children}</div>
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-lift animate-scale-in">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ---------------- DetailModal ----------------
// Read-only detail view reused by the list pages: a compact key/value grid for
// short facts (date, financial year, amount…) plus long-text sections
// (description, notes). Empty long-text sections show a muted placeholder so it's
// always clear whether the editor/admin actually wrote something.
export function DetailModal({
  open,
  onClose,
  title,
  rows = [],
  sections = [],
}: {
  open: boolean
  onClose: () => void
  title: string
  rows?: { label: string; value: ReactNode }[]
  sections?: { label: string; value?: string }[]
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {rows.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{r.value || <span className="text-muted">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {sections.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-line/60 pt-4">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              {s.value?.trim() ? (
                <p className="whitespace-pre-wrap text-sm text-ink">{s.value}</p>
              ) : (
                <p className="text-sm italic text-muted">Not provided.</p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}

// ---------------- Form fields ----------------
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputClass} />
}

// Small inline checkbox with a label (theme-aware; accent follows the brand color).
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-line bg-surface text-primary accent-[rgb(var(--color-primary))] focus:ring-2 focus:ring-primary/30"
      />
      <span>
        {label}
        {hint && <span className="ml-1 text-muted">{hint}</span>}
      </span>
    </label>
  )
}

// Select2-backed form dropdown (same API as a native <select>).
export function FormSelect({ children, value, onChange }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Select2Base value={value} onChange={onChange} containerClassName="w-full">
      {children}
    </Select2Base>
  )
}

// ---------------- DatePicker (flatpickr) ----------------
// Calendar-backed date field. Emits ISO `YYYY-MM-DD`; shows "15 Apr 2024" via altInput.
// Month is a dropdown and the year is directly editable, so you can jump to any
// year/month without paging through months one at a time.
export function DatePicker({
  value,
  onChange,
  required,
  disabled,
  placeholder = 'Select date',
  maxDate,
}: {
  value: string
  onChange: (iso: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  // Pass "today" to block future dates (used for Start Date / Receipt Date).
  maxDate?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const fpRef = useRef<Instance | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!ref.current) return
    const fp = flatpickr(ref.current, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd M Y',
      allowInput: true,
      monthSelectorType: 'dropdown',
      defaultDate: value || undefined,
      maxDate,
      onChange: (_dates, iso) => onChangeRef.current(iso),
    }) as Instance
    if (fp.altInput) {
      fp.altInput.className = inputClass
      fp.altInput.placeholder = placeholder
      if (required) fp.altInput.required = true
    }
    fpRef.current = fp
    return () => fp.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const fp = fpRef.current
    if (!fp) return
    if (value && value !== fp.input.value) fp.setDate(value, false)
    else if (!value && fp.input.value) fp.clear(false)
  }, [value])

  // Reflect the disabled + required + placeholder state onto flatpickr's altInput.
  useEffect(() => {
    const fp = fpRef.current
    if (!fp?.altInput) return
    fp.set('clickOpens', !disabled)
    fp.altInput.disabled = Boolean(disabled)
    fp.altInput.required = Boolean(required)
    fp.altInput.placeholder = placeholder
  }, [disabled, required, placeholder])

  useEffect(() => {
    fpRef.current?.set('maxDate', maxDate)
  }, [maxDate])

  return <input ref={ref} type="text" className={inputClass} />
}

// ---------------- ConfirmDialog ----------------
export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-lift animate-scale-in">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-danger/25 transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
