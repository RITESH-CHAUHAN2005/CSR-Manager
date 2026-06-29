import { useEffect, useRef, type ReactNode, type SelectHTMLAttributes } from 'react'
import flatpickr from 'flatpickr'
import type { Instance } from 'flatpickr/dist/types/instance'
import 'flatpickr/dist/flatpickr.min.css'
import { ChevronDown, Plus, Search, X } from './icons'

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
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-success/15 text-success ring-success/20',
    completed: 'bg-primary/15 text-primary ring-primary/20',
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
      {status}
    </span>
  )
}

// ---------------- Select (filter dropdown) ----------------
export function Select({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-block w-full sm:w-auto">
      <select
        {...props}
        className={`w-full appearance-none rounded-xl border border-line bg-surface/70 px-3.5 py-2.5 pr-9 text-sm text-ink shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 sm:w-52 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
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

export function FormSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${inputClass} appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

// ---------------- DatePicker (flatpickr) ----------------
// Calendar-backed date field used everywhere a date is entered. Stores/emits an ISO
// `YYYY-MM-DD` string (what the backend validators expect) while showing a friendly
// "15 Apr 2024" format to the user via flatpickr's altInput.
export function DatePicker({
  value,
  onChange,
  required,
  placeholder = 'Select date',
}: {
  value: string
  onChange: (iso: string) => void
  required?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const fpRef = useRef<Instance | null>(null)
  // Keep the latest onChange without re-initialising flatpickr on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!ref.current) return
    const fp = flatpickr(ref.current, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd M Y',
      allowInput: true,
      defaultDate: value || undefined,
      onChange: (_dates, iso) => onChangeRef.current(iso),
    }) as Instance
    // Mirror the `required` flag and styling onto the visible (alt) input.
    if (fp.altInput) {
      fp.altInput.className = inputClass
      fp.altInput.placeholder = placeholder
      if (required) fp.altInput.required = true
    }
    fpRef.current = fp
    return () => fp.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (e.g. when an edit modal populates the form).
  useEffect(() => {
    const fp = fpRef.current
    if (!fp) return
    if (value && value !== fp.input.value) fp.setDate(value, false)
    else if (!value && fp.input.value) fp.clear(false)
  }, [value])

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
