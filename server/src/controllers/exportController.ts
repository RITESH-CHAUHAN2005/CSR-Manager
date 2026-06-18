import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { asyncHandler } from '../utils/asyncHandler.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const inr = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)

async function yearRows() {
  const [years, receipts, expenditures] = await Promise.all([
    FinancialYear.find().sort({ createdAt: 1 }),
    FundReceipt.find(),
    Expenditure.find(),
  ])
  return years.map((y) => {
    const id = String(y._id)
    const fundsReceived = sum(receipts.filter((r) => String(r.financialYearId) === id).map((r) => r.amount))
    const carryForwardIn = sum(receipts.filter((r) => String(r.financialYearId) === id).map((r) => r.carryForward))
    const expenditure = sum(expenditures.filter((e) => String(e.financialYearId) === id).map((e) => e.amount))
    const totalAvailable = fundsReceived + carryForwardIn
    const balance = totalAvailable - expenditure
    return { name: y.name, fundsReceived, carryForwardIn, totalAvailable, expenditure, balance, carryForwardOut: balance }
  })
}

const HEADERS = [
  'Financial Year',
  'Funds Received',
  'Carry Forward In',
  'Total Available',
  'Expenditure',
  'Balance',
  'Carry Forward Out',
]

export const exportExcel = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await yearRows()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Year-wise Report')

  ws.addRow(HEADERS)
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const r of rows) {
    ws.addRow([r.name, r.fundsReceived, r.carryForwardIn, r.totalAvailable, r.expenditure, r.balance, r.carryForwardOut])
  }
  ws.addRow([
    'Total',
    sum(rows.map((r) => r.fundsReceived)),
    sum(rows.map((r) => r.carryForwardIn)),
    sum(rows.map((r) => r.totalAvailable)),
    sum(rows.map((r) => r.expenditure)),
    sum(rows.map((r) => r.balance)),
    sum(rows.map((r) => r.carryForwardOut)),
  ]).font = { bold: true }

  ws.columns.forEach((c) => (c.width = 20))
  ws.eachRow((row, n) => {
    if (n > 1) row.eachCell((cell, col) => { if (col > 1) cell.numFmt = '#,##0.00' })
  })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="year-wise-report.xlsx"')
  await wb.xlsx.write(res)
  res.end()
})

export const exportPdf = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await yearRows()
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="year-wise-report.pdf"')
  doc.pipe(res)

  doc.fontSize(18).fillColor('#1e293b').text('CSR Manager — Year-wise Financial Report', { align: 'left' })
  doc.moveDown(0.5)

  const startX = 40
  let y = doc.y + 10
  const colW = [120, 110, 110, 110, 110, 110, 110]
  const drawRow = (cells: string[], bold = false) => {
    let x = startX
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#0f172a')
    cells.forEach((c, i) => {
      doc.text(c, x + 4, y + 5, { width: colW[i] - 8, align: i === 0 ? 'left' : 'right' })
      x += colW[i]
    })
    y += 22
  }

  drawRow(HEADERS, true)
  for (const r of rows) {
    drawRow([
      r.name, inr(r.fundsReceived), inr(r.carryForwardIn), inr(r.totalAvailable),
      inr(r.expenditure), inr(r.balance), inr(r.carryForwardOut),
    ])
  }
  drawRow([
    'Total', inr(sum(rows.map((r) => r.fundsReceived))), inr(sum(rows.map((r) => r.carryForwardIn))),
    inr(sum(rows.map((r) => r.totalAvailable))), inr(sum(rows.map((r) => r.expenditure))),
    inr(sum(rows.map((r) => r.balance))), inr(sum(rows.map((r) => r.carryForwardOut))),
  ], true)

  doc.end()
})
