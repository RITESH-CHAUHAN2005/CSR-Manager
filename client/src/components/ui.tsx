import { type ReactNode, type SelectHTMLAttributes } from 'react'
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
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------------- PrimaryButton ----------------
export function PrimaryButton({
  children,
  icon = true,
  ...props
}: { children: ReactNode; icon?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50"
    >
      {icon && <Plus size={16} weight="bold" />}
      {children}
    </button>
  )
}

// ---------------- StatusBadge ----------------
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-teal-100 text-teal-700',
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  )
}

// ---------------- Select ----------------
export function Select({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-block">
      <select
        {...props}
        className={`w-52 appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
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
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

// ---------------- Card ----------------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputClass} />
}

export function FormSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={inputClass}>
      {children}
    </select>
  )
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
