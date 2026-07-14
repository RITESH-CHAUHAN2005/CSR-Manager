import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { asyncHandler } from '../utils/asyncHandler.js'
import { Company } from '../models/Company.js'
import { Project } from '../models/Project.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'
import { findCurrentFinancialYear } from '../utils/financialYear.js'
import { carryForwardByCompany, carryForwardRows, yearFundFlow } from '../utils/carryForward.js'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const inr = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)

type ColKind = 'text' | 'money' | 'number' | 'percent'
interface Column {
  header: string
  width: number
  kind: ColKind
}
interface ReportSpec {
  title: string
  filename: string
  columns: Column[]
  rows: (string | number)[][]
  totals?: (string | number)[]
}

// ---------------- Aggregations (mirror the client report tabs) ----------------

async function yearReport(): Promise<ReportSpec> {
  const [years, receipts, expenditures] = await Promise.all([
    FinancialYear.find().sort({ startDate: 1 }),
    FundReceipt.find(),
    Expenditure.find(),
  ])
  const flow = yearFundFlow({ years, receipts, expenditures })
  const rows = flow.map((r) => [
    r.yearName,
    r.fundsReceived,
    r.carryForwardIn,
    r.totalAvailable,
    r.expenditure,
    r.balance,
    r.carryForwardOut,
  ])
  return {
    title: 'Year-wise Financial Report',
    filename: 'year-wise-report',
    columns: [
      { header: 'Financial Year', width: 130, kind: 'text' },
      { header: 'Funds Received', width: 105, kind: 'money' },
      { header: 'Carry Forward In', width: 105, kind: 'money' },
      { header: 'Total Available', width: 105, kind: 'money' },
      { header: 'Expenditure', width: 105, kind: 'money' },
      { header: 'Balance', width: 105, kind: 'money' },
      { header: 'Carry Forward Out', width: 105, kind: 'money' },
    ],
    rows,
    // Carry Forward In/Out and Total Available are running positions, not flows —
    // summing them down the column would be meaningless, so only the flows are totalled.
    totals: [
      'Total',
      sum(flow.map((r) => r.fundsReceived)),
      '',
      '',
      sum(flow.map((r) => r.expenditure)),
      flow.at(-1)?.balance ?? 0,
      flow.at(-1)?.carryForwardOut ?? 0,
    ],
  }
}

async function companyReport(): Promise<ReportSpec> {
  const [companies, receipts, expenditures, projects] = await Promise.all([
    Company.find().sort({ createdAt: 1 }),
    FundReceipt.find(),
    Expenditure.find(),
    Project.find(),
  ])
  const carried = carryForwardByCompany(carryForwardRows({ projects, companies, receipts, expenditures }))
  const rows = companies.map((c) => {
    const id = String(c._id)
    const received = sum(receipts.filter((r) => String(r.companyId) === id).map((r) => r.amount))
    const myProjects = projects.filter((p) => p.companyIds.some((cid) => String(cid) === id))
    const expenditure = sum(
      expenditures.filter((e) => String(e.companyId) === id).map((e) => e.amount),
    )
    // Carry Forward = unspent money on this company's Ongoing projects. It is part of
    // the balance, not an addition to it.
    return [c.name, received, expenditure, received - expenditure, carried.get(id) ?? 0, myProjects.length]
  })
  const col = (i: number) => sum(rows.map((r) => Number(r[i])))
  return {
    title: 'Company-wise Financial Report',
    filename: 'company-wise-report',
    columns: [
      { header: 'Company', width: 190, kind: 'text' },
      { header: 'Total Received', width: 110, kind: 'money' },
      { header: 'Expenditure', width: 110, kind: 'money' },
      { header: 'Balance', width: 110, kind: 'money' },
      { header: 'Carry Forward', width: 110, kind: 'money' },
      { header: 'Projects', width: 70, kind: 'number' },
    ],
    rows,
    totals: ['Total', col(1), col(2), col(3), col(4), col(5)],
  }
}

async function projectReport(): Promise<ReportSpec> {
  const [projects, companies, expenditures, receipts] = await Promise.all([
    Project.find().sort({ createdAt: 1 }),
    Company.find(),
    Expenditure.find(),
    FundReceipt.find(),
  ])
  const rows = projects.map((p) => {
    const id = String(p._id)
    const spent = sum(expenditures.filter((e) => String(e.projectId) === id).map((e) => e.amount))
    // What has actually landed against this project. Budget is the approved cost.
    const received = sum(receipts.filter((r) => String(r.projectId) === id).map((r) => r.amount))
    const companyNames =
      companies
        .filter((c) => p.companyIds.some((cid) => String(cid) === String(c._id)))
        .map((c) => c.name)
        .join(', ') || '—'
    const utilization = p.budget ? Math.round((spent / p.budget) * 100) : 0
    return [
      p.projectCode || '—',
      p.name,
      companyNames,
      p.interventionPartner || '—',
      p.budget,
      received,
      spent,
      utilization,
      p.status,
    ]
  })
  return {
    title: 'Project-wise Financial Report',
    filename: 'project-wise-report',
    columns: [
      { header: 'Project ID', width: 85, kind: 'text' },
      { header: 'Project', width: 125, kind: 'text' },
      { header: 'Company', width: 125, kind: 'text' },
      { header: 'Intervention Partner', width: 115, kind: 'text' },
      { header: 'Budget', width: 90, kind: 'money' },
      { header: 'Received', width: 90, kind: 'money' },
      { header: 'Spent', width: 90, kind: 'money' },
      { header: 'Utilization', width: 70, kind: 'percent' },
      { header: 'Status', width: 70, kind: 'text' },
    ],
    rows,
  }
}

async function carryForwardReport(): Promise<ReportSpec> {
  const [projects, companies, expenditures, receipts, years] = await Promise.all([
    Project.find().sort({ createdAt: 1 }),
    Company.find(),
    Expenditure.find(),
    FundReceipt.find(),
    FinancialYear.find(),
  ])
  const currentFy = findCurrentFinancialYear(years)
  const nextFy = currentFy
    ? [...years]
        .filter((y) => y.startDate > currentFy.endDate)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    : undefined
  const rollsInto = nextFy?.name ?? '—'

  const cf = carryForwardRows({ projects, companies, receipts, expenditures })
  const rows = cf.map((r) => [
    r.projectCode || '—',
    r.projectName,
    r.companyName,
    r.received,
    r.spent,
    r.carryForward,
    rollsInto,
  ])
  const col = (i: number) => sum(rows.map((r) => Number(r[i])))

  return {
    title: 'Project Carry Forward Report',
    filename: 'carry-forward-report',
    columns: [
      { header: 'Project ID', width: 90, kind: 'text' },
      { header: 'Project', width: 150, kind: 'text' },
      { header: 'Company', width: 150, kind: 'text' },
      { header: 'Received', width: 105, kind: 'money' },
      { header: 'Spent', width: 105, kind: 'money' },
      { header: 'Carry Forward', width: 110, kind: 'money' },
      { header: 'Rolls Into', width: 95, kind: 'text' },
    ],
    rows,
    totals: ['Total', '', '', col(3), col(4), col(5), ''],
  }
}

async function ledgerReport(): Promise<ReportSpec> {
  const [receipts, expenditures, companies, projects, years] = await Promise.all([
    FundReceipt.find(),
    Expenditure.find(),
    Company.find(),
    Project.find(),
    FinancialYear.find(),
  ])
  const companyName = (id: unknown) => companies.find((c) => String(c._id) === String(id))?.name ?? '—'
  const project = (id: unknown) => projects.find((p) => String(p._id) === String(id))
  const projectName = (id: unknown) => (id ? project(id)?.name ?? '—' : '—')
  const projectCode = (id: unknown) => (id ? project(id)?.projectCode || '—' : '—')
  const yearName = (id: unknown) => years.find((y) => String(y._id) === String(id))?.name ?? '—'

  const merged = [
    ...receipts.map((r) => ({
      type: 'Receipt',
      date: r.date,
      code: projectCode(r.projectId),
      company: r.receiptType === 'other_source' ? r.source || 'Other Source' : companyName(r.companyId),
      project: projectName(r.projectId),
      fy: yearName(r.financialYearId),
      base: r.amount,
    })),
    ...expenditures.map((e) => ({
      type: 'Expenditure',
      date: e.date,
      code: projectCode(e.projectId),
      company: companyName(e.companyId),
      project: projectName(e.projectId),
      fy: yearName(e.financialYearId),
      base: e.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  let running = 0
  const rows = merged.map((r) => {
    running += r.type === 'Receipt' ? r.base : -r.base
    return [r.type, r.date, r.code, r.project, r.company, r.fy, r.base, running]
  })

  return {
    title: 'Master Transaction Ledger',
    filename: 'transaction-ledger',
    columns: [
      { header: 'Type', width: 85, kind: 'text' },
      { header: 'Date', width: 85, kind: 'text' },
      { header: 'Project ID', width: 95, kind: 'text' },
      { header: 'Project', width: 145, kind: 'text' },
      { header: 'Company', width: 145, kind: 'text' },
      { header: 'FY', width: 85, kind: 'text' },
      { header: 'Amount', width: 105, kind: 'money' },
      { header: 'Running Balance', width: 110, kind: 'money' },
    ],
    rows,
  }
}

async function buildReport(type: string): Promise<ReportSpec> {
  if (type === 'company') return companyReport()
  if (type === 'project') return projectReport()
  if (type === 'carryForward') return carryForwardReport()
  if (type === 'ledger') return ledgerReport()
  return yearReport()
}

function fmtCell(value: string | number, kind: ColKind): string {
  // A blank cell stays blank — a running-position column has no meaningful total.
  if (value === '' || value === null || value === undefined) return ''
  if (kind === 'money') return inr(Number(value))
  if (kind === 'percent') return `${value}%`
  return String(value)
}

// ---------------- Excel ----------------

export const exportExcel = asyncHandler(async (req: Request, res: Response) => {
  const spec = await buildReport(String(req.query.type ?? 'year'))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(spec.title.slice(0, 28))

  const header = ws.addRow(spec.columns.map((c) => c.header))
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009CA6' } }
    cell.alignment = { vertical: 'middle' }
  })

  for (const r of spec.rows) ws.addRow(r)
  if (spec.totals) ws.addRow(spec.totals).font = { bold: true }

  spec.columns.forEach((c, i) => {
    const column = ws.getColumn(i + 1)
    column.width = Math.max(14, Math.round(c.width / 6))
    if (c.kind === 'money') column.numFmt = '#,##0.00'
  })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ---------------- PDF ----------------

export const exportPdf = asyncHandler(async (req: Request, res: Response) => {
  const spec = await buildReport(String(req.query.type ?? 'year'))
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}.pdf"`)
  doc.pipe(res)

  const startX = 40
  const rowH = 22
  const bottomLimit = doc.page.height - 50

  // Header band
  doc.fontSize(18).fillColor('#0f172a').text('CSR Manager', startX, 40)
  doc.fontSize(13).fillColor('#009ca6').text(spec.title, startX, 64)
  const generated = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  doc.fontSize(8).fillColor('#94a3b8').text(`Generated: ${generated}`, startX, 82)

  let y = 100

  const drawHeader = () => {
    let x = startX
    doc.rect(startX, y, sum(spec.columns.map((c) => c.width)), rowH).fill('#009ca6')
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
    spec.columns.forEach((c) => {
      doc.text(c.header, x + 5, y + 6, { width: c.width - 10, align: c.kind === 'text' ? 'left' : 'right' })
      x += c.width
    })
    y += rowH
  }

  const drawRow = (cells: (string | number)[], opts: { bold?: boolean; tint?: boolean } = {}) => {
    if (y + rowH > bottomLimit) {
      doc.addPage()
      y = 50
      drawHeader()
    }
    const totalW = sum(spec.columns.map((c) => c.width))
    if (opts.tint) doc.rect(startX, y, totalW, rowH).fill('#f1f5f9')
    if (opts.bold) doc.rect(startX, y, totalW, rowH).fill('#e2e8f0')
    let x = startX
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#0f172a')
    spec.columns.forEach((c, i) => {
      doc.text(fmtCell(cells[i], c.kind), x + 5, y + 6, {
        width: c.width - 10,
        align: c.kind === 'text' ? 'left' : 'right',
      })
      x += c.width
    })
    y += rowH
  }

  drawHeader()
  spec.rows.forEach((r, i) => drawRow(r, { tint: i % 2 === 1 }))
  if (spec.totals) drawRow(spec.totals, { bold: true })

  if (spec.rows.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#94a3b8').text('No records found.', startX, y + 10)
  }

  doc.end()
})
