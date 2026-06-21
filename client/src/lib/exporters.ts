// Client-side export helpers used in the Phase-2 demo.
// Phase 3 adds server endpoints (/api/reports/export/pdf | /excel) that stream proper
// xlsx + pdf files; these stay as a fast client fallback.

type Cell = string | number

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const escape = (v: Cell) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  // Prepend BOM so Excel reads UTF-8 (₹ symbol) correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Trigger a browser download for a Blob (e.g. a server-generated PDF/xlsx).
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Fallback only: browser print dialog (used when the server export is unavailable).
export function printReport() {
  window.print()
}
