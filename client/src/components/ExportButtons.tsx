import { useState } from 'react'
import { FileDown, FileText } from './icons'
import { USE_API } from '../services/api'
import { analyticsService } from '../services/dataService'
import { downloadCsv, printReport, saveBlob } from '../lib/exporters'
import type { ExportType } from '../types'

// The two export buttons that sit at the top-right of a page (same look as the Reports
// page). They stream the FULL table for `entity` — every record, every column — from
// the server as a proper PDF / xlsx. When the live API is off (offline mock mode) they
// fall back to a client-side CSV (Excel) / browser print (PDF) built from `csv`, so the
// buttons still do something useful and the columns match what the page shows.
export function ExportButtons({
  entity,
  params,
  csv,
  className = '',
}: {
  entity: ExportType
  // Extra query args for the server export (e.g. { companyId } for a company-detail export).
  params?: Record<string, string>
  csv?: { filename: string; headers: string[]; rows: (string | number)[][] }
  className?: string
}) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  function fallback(format: 'pdf' | 'excel') {
    if (format === 'pdf') printReport()
    else if (csv) downloadCsv(csv.filename, csv.headers, csv.rows)
  }

  async function onExport(format: 'pdf' | 'excel') {
    if (!USE_API) {
      fallback(format)
      return
    }
    setExporting(format)
    try {
      const blob = await analyticsService.exportReport(entity, format, params)
      saveBlob(blob, `${entity}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      fallback(format)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button
        onClick={() => onExport('pdf')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-ink/5 disabled:opacity-50"
      >
        <FileText size={16} /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </button>
      <button
        onClick={() => onExport('excel')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
      >
        <FileDown size={16} /> {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
      </button>
    </div>
  )
}
