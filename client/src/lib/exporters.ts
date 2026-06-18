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

// Uses the browser's print dialog (user can "Save as PDF").
export function printReport() {
  window.print()
}
