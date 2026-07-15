import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { asyncHandler } from '../utils/asyncHandler.js'
import { Company } from '../models/Company.js'
import { Project } from '../models/Project.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'
import { MasterDataItem } from '../models/MasterDataItem.js'
import { User } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'
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
interface ReportSection {
  heading: string
  columns: Column[]
  rows: (string | number)[][]
  totals?: (string | number)[]
}
interface ReportSpec {
  title: string
  filename: string
  columns: Column[]
  rows: (string | number)[][]
  totals?: (string | number)[]
  // When present, the renderers draw one table per section (each with its own
  // heading + columns) instead of the single top-level columns/rows table. A
  // section-based spec still sets columns:[]/rows:[] to satisfy the type.
  sections?: ReportSection[]
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

// ---------------- Raw record exports (one row per stored record) ----------------

async function companiesReport(): Promise<ReportSpec> {
  const companies = await Company.find().sort({ createdAt: 1 })
  const rows = companies.map((c) => [
    c.name,
    c.cin || '—',
    c.pan || '—',
    c.contactPerson || '—',
    c.email || '—',
    c.phone || '—',
    c.address || '—',
  ])
  return {
    title: 'Companies',
    filename: 'companies',
    columns: [
      { header: 'Name', width: 150, kind: 'text' },
      { header: 'CIN', width: 130, kind: 'text' },
      { header: 'PAN', width: 100, kind: 'text' },
      { header: 'Contact Person', width: 120, kind: 'text' },
      { header: 'Email', width: 140, kind: 'text' },
      { header: 'Phone', width: 100, kind: 'text' },
      { header: 'Address', width: 160, kind: 'text' },
    ],
    rows,
  }
}

async function projectsListReport(): Promise<ReportSpec> {
  const [projects, companies] = await Promise.all([
    Project.find().sort({ createdAt: 1 }),
    Company.find(),
  ])
  const rows = projects.map((p) => {
    const companyNames =
      companies
        .filter((c) => p.companyIds.some((cid) => String(cid) === String(c._id)))
        .map((c) => c.name)
        .join(', ') || '—'
    return [
      p.projectCode || '—',
      p.name,
      companyNames,
      p.category || '—',
      p.interventionPartner || '—',
      p.budget,
      p.status,
      p.startDate || '—',
      p.endDate || '—',
    ]
  })
  return {
    title: 'Projects',
    filename: 'projects',
    columns: [
      { header: 'Project ID', width: 85, kind: 'text' },
      { header: 'Project', width: 130, kind: 'text' },
      { header: 'Companies', width: 130, kind: 'text' },
      { header: 'Category', width: 100, kind: 'text' },
      { header: 'Intervention Partner', width: 115, kind: 'text' },
      { header: 'Budget', width: 100, kind: 'money' },
      { header: 'Status', width: 70, kind: 'text' },
      { header: 'Start', width: 85, kind: 'text' },
      { header: 'End', width: 85, kind: 'text' },
    ],
    rows,
  }
}

async function fundReceiptsReport(): Promise<ReportSpec> {
  const [receipts, companies, projects, years] = await Promise.all([
    FundReceipt.find().sort({ date: 1 }),
    Company.find(),
    Project.find(),
    FinancialYear.find(),
  ])
  const companyName = (id: unknown) => companies.find((c) => String(c._id) === String(id))?.name ?? ''
  const project = (id: unknown) => projects.find((p) => String(p._id) === String(id))
  const projectName = (id: unknown) => (id ? project(id)?.name ?? '—' : '—')
  const projectCode = (id: unknown) => (id ? project(id)?.projectCode || '—' : '—')
  const yearName = (id: unknown) => years.find((y) => String(y._id) === String(id))?.name ?? '—'

  const rows = receipts.map((r) => {
    const cName = companyName(r.companyId)
    // Company FIRST, then source — matches the app UI. For an "other source" receipt
    // there may be no donor company, so fall back to the source alone.
    const donor =
      r.receiptType === 'other_source'
        ? cName
          ? `${cName} — ${r.source ?? ''}`
          : r.source ?? ''
        : cName || '—'
    return [
      r.date,
      donor || '—',
      yearName(r.financialYearId),
      projectCode(r.projectId),
      projectName(r.projectId),
      r.reference || '—',
      r.amount,
    ]
  })
  return {
    title: 'Fund Receipts',
    filename: 'fund-receipts',
    columns: [
      { header: 'Date', width: 85, kind: 'text' },
      { header: 'Donor Company / Source', width: 160, kind: 'text' },
      { header: 'Financial Year', width: 110, kind: 'text' },
      { header: 'Project ID', width: 90, kind: 'text' },
      { header: 'Project', width: 140, kind: 'text' },
      { header: 'Account Number', width: 120, kind: 'text' },
      { header: 'Amount', width: 105, kind: 'money' },
    ],
    rows,
    totals: ['Total', '', '', '', '', '', sum(receipts.map((r) => r.amount))],
  }
}

async function expendituresReport(): Promise<ReportSpec> {
  const [expenditures, companies, projects, years] = await Promise.all([
    Expenditure.find().sort({ date: 1 }),
    Company.find(),
    Project.find(),
    FinancialYear.find(),
  ])
  const companyName = (id: unknown) => companies.find((c) => String(c._id) === String(id))?.name ?? '—'
  const project = (id: unknown) => projects.find((p) => String(p._id) === String(id))
  const projectName = (id: unknown) => (id ? project(id)?.name ?? '—' : '—')
  const projectCode = (id: unknown) => (id ? project(id)?.projectCode || '—' : '—')
  const yearName = (id: unknown) => years.find((y) => String(y._id) === String(id))?.name ?? '—'

  const rows = expenditures.map((e) => [
    e.date,
    projectCode(e.projectId),
    projectName(e.projectId),
    companyName(e.companyId),
    yearName(e.financialYearId),
    e.approvedBy || '—',
    e.reference || '—',
    e.amount,
  ])
  return {
    title: 'Expenditures',
    filename: 'expenditures',
    columns: [
      { header: 'Date', width: 85, kind: 'text' },
      { header: 'Project ID', width: 90, kind: 'text' },
      { header: 'Project', width: 140, kind: 'text' },
      { header: 'Company', width: 130, kind: 'text' },
      { header: 'Financial Year', width: 100, kind: 'text' },
      { header: 'Approved By', width: 110, kind: 'text' },
      { header: 'Reference', width: 100, kind: 'text' },
      { header: 'Amount', width: 105, kind: 'money' },
    ],
    rows,
    totals: ['Total', '', '', '', '', '', '', sum(expenditures.map((e) => e.amount))],
  }
}

async function financialYearsReport(): Promise<ReportSpec> {
  const years = await FinancialYear.find().sort({ startDate: 1 })
  const rows = years.map((y) => [y.name, y.startDate, y.endDate, y.isActive ? 'Yes' : 'No'])
  return {
    title: 'Financial Years',
    filename: 'financial-years',
    columns: [
      { header: 'Financial Year', width: 150, kind: 'text' },
      { header: 'Start Date', width: 120, kind: 'text' },
      { header: 'End Date', width: 120, kind: 'text' },
      { header: 'Active', width: 90, kind: 'text' },
    ],
    rows,
  }
}

async function masterDataReport(): Promise<ReportSpec> {
  const items = await MasterDataItem.find().sort({ type: 1, value: 1 })
  const rows = items.map((m) => [m.type, m.value, m.description || '—'])
  return {
    title: 'Master Data',
    filename: 'master-data',
    columns: [
      { header: 'Type', width: 120, kind: 'text' },
      { header: 'Value', width: 160, kind: 'text' },
      { header: 'Description', width: 320, kind: 'text' },
    ],
    rows,
  }
}

async function usersReport(): Promise<ReportSpec> {
  const [users, companies] = await Promise.all([
    User.find().sort({ createdAt: -1 }),
    Company.find(),
  ])
  const companyName = (id: unknown) => companies.find((c) => String(c._id) === String(id))?.name ?? '—'
  const rows = users.map((u) => [u.name, u.email, u.role, companyName(u.companyId)])
  return {
    title: 'Users',
    filename: 'users',
    columns: [
      { header: 'Name', width: 160, kind: 'text' },
      { header: 'Email', width: 200, kind: 'text' },
      { header: 'Role', width: 100, kind: 'text' },
      { header: 'Company', width: 160, kind: 'text' },
    ],
    rows,
  }
}

async function companyDetailReport(companyId: string): Promise<ReportSpec> {
  const [company, allReceipts, allExpenditures, projects, companies, years] = await Promise.all([
    companyId ? Company.findById(companyId) : Promise.resolve(null),
    FundReceipt.find(),
    Expenditure.find(),
    Project.find(),
    Company.find(),
    FinancialYear.find().sort({ startDate: 1 }),
  ])

  const companyReceipts = allReceipts.filter((r) => String(r.companyId) === companyId)
  const companyExpenditures = allExpenditures.filter((e) => String(e.companyId) === companyId)
  const companyProjects = projects.filter((p) =>
    p.companyIds.some((cid) => String(cid) === companyId),
  )

  const yearName = (id: unknown) => years.find((y) => String(y._id) === String(id))?.name ?? '—'
  const project = (id: unknown) => projects.find((p) => String(p._id) === String(id))
  const projectName = (id: unknown) => (id ? project(id)?.name ?? '—' : '—')
  const projectCode = (id: unknown) => (id ? project(id)?.projectCode || '—' : '—')

  const totalReceived = sum(companyReceipts.map((r) => r.amount))
  const totalExpenditure = sum(companyExpenditures.map((e) => e.amount))
  const currentBalance = totalReceived - totalExpenditure
  const carryForward =
    carryForwardByCompany(
      carryForwardRows({
        projects,
        companies,
        receipts: allReceipts,
        expenditures: allExpenditures,
      }),
    ).get(companyId) ?? 0
  const activeProjects = companyProjects.filter((p) => p.status === 'active').length

  const yearFlow = yearFundFlow({
    years,
    receipts: companyReceipts,
    expenditures: companyExpenditures,
  }).filter((r) => r.fundsReceived > 0 || r.expenditure > 0)

  const sections: ReportSection[] = [
    {
      heading: 'Company Information',
      columns: [
        { header: 'Field', width: 150, kind: 'text' },
        { header: 'Value', width: 400, kind: 'text' },
      ],
      rows: [
        ['Name', company?.name ?? '—'],
        ['CIN', company?.cin || '—'],
        ['PAN', company?.pan || '—'],
        ['Contact Person', company?.contactPerson || '—'],
        ['Email', company?.email || '—'],
        ['Phone', company?.phone || '—'],
        ['Address', company?.address || '—'],
        ['Description', company?.description || '—'],
      ],
    },
    {
      heading: 'Fund Overview',
      columns: [
        { header: 'Total Received', width: 110, kind: 'money' },
        { header: 'Carry Forward', width: 110, kind: 'money' },
        { header: 'Total Expenditure', width: 120, kind: 'money' },
        { header: 'Current Balance', width: 110, kind: 'money' },
        { header: 'Total Projects', width: 90, kind: 'number' },
        { header: 'Active Projects', width: 90, kind: 'number' },
      ],
      rows: [
        [
          totalReceived,
          carryForward,
          totalExpenditure,
          currentBalance,
          companyProjects.length,
          activeProjects,
        ],
      ],
    },
    {
      heading: 'Year-wise Fund Summary',
      columns: [
        { header: 'Financial Year', width: 130, kind: 'text' },
        { header: 'Received', width: 105, kind: 'money' },
        { header: 'Carry Forward In', width: 110, kind: 'money' },
        { header: 'Expenditure', width: 105, kind: 'money' },
        { header: 'Balance', width: 105, kind: 'money' },
        { header: 'Carry Forward Out', width: 115, kind: 'money' },
      ],
      rows: yearFlow.map((r) => [
        r.yearName,
        r.fundsReceived,
        r.carryForwardIn,
        r.expenditure,
        r.balance,
        r.carryForwardOut,
      ]),
    },
    {
      heading: 'Projects',
      columns: [
        { header: 'Project ID', width: 95, kind: 'text' },
        { header: 'Project', width: 170, kind: 'text' },
        { header: 'Category', width: 120, kind: 'text' },
        { header: 'Budget', width: 110, kind: 'money' },
        { header: 'Status', width: 80, kind: 'text' },
      ],
      rows: companyProjects.map((p) => [
        p.projectCode || '—',
        p.name,
        p.category || '—',
        p.budget,
        p.status,
      ]),
    },
    {
      heading: 'Fund Receipts',
      columns: [
        { header: 'Date', width: 90, kind: 'text' },
        { header: 'Source', width: 150, kind: 'text' },
        { header: 'Financial Year', width: 110, kind: 'text' },
        { header: 'Project ID', width: 95, kind: 'text' },
        { header: 'Project', width: 150, kind: 'text' },
        { header: 'Account Number', width: 130, kind: 'text' },
        { header: 'Amount', width: 105, kind: 'money' },
      ],
      rows: companyReceipts.map((r) => [
        r.date,
        r.source || '—',
        yearName(r.financialYearId),
        projectCode(r.projectId),
        projectName(r.projectId),
        r.reference || '—',
        r.amount,
      ]),
      totals: ['Total', '', '', '', '', '', sum(companyReceipts.map((r) => r.amount))],
    },
  ]

  return {
    title: `Company — ${company?.name ?? ''}`,
    filename: `company-${companyId}`,
    columns: [],
    rows: [],
    sections,
  }
}

async function activityLogsReport(): Promise<ReportSpec> {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(5000)
  const rows = logs.map((l) => [
    new Date((l as unknown as { createdAt: Date }).createdAt).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    }),
    l.userEmail,
    l.userRole || '—',
    l.action,
    l.entity || '—',
    l.label || '—',
  ])
  return {
    title: 'Activity Logs',
    filename: 'activity-logs',
    columns: [
      { header: 'When', width: 130, kind: 'text' },
      { header: 'User', width: 150, kind: 'text' },
      { header: 'Role', width: 70, kind: 'text' },
      { header: 'Action', width: 90, kind: 'text' },
      { header: 'Entity', width: 90, kind: 'text' },
      { header: 'Details', width: 200, kind: 'text' },
    ],
    rows,
  }
}

async function buildReport(type: string, query: Record<string, unknown> = {}): Promise<ReportSpec> {
  if (type === 'company-detail') return companyDetailReport(String(query.companyId ?? ''))
  if (type === 'activity-logs') return activityLogsReport()
  if (type === 'company') return companyReport()
  if (type === 'project') return projectReport()
  if (type === 'carryForward') return carryForwardReport()
  if (type === 'ledger') return ledgerReport()
  if (type === 'companies') return companiesReport()
  if (type === 'projects') return projectsListReport()
  if (type === 'fund-receipts') return fundReceiptsReport()
  if (type === 'expenditures') return expendituresReport()
  if (type === 'financial-years') return financialYearsReport()
  if (type === 'master-data') return masterDataReport()
  if (type === 'users') return usersReport()
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
  const spec = await buildReport(String(req.query.type ?? 'year'), req.query as Record<string, unknown>)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(spec.title.slice(0, 28))

  if (spec.sections?.length) {
    let maxCols = 0
    for (const section of spec.sections) {
      maxCols = Math.max(maxCols, section.columns.length)

      // Section heading — bold, slightly larger.
      const headingRow = ws.addRow([section.heading])
      headingRow.getCell(1).font = { bold: true, size: 12 }

      // Column header row — bold white on teal, matching the single-table style.
      const headerRow = ws.addRow(section.columns.map((c) => c.header))
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      section.columns.forEach((_c, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009CA6' } }
        cell.alignment = { vertical: 'middle' }
      })

      // Data rows — money cells get the currency number format.
      for (const r of section.rows) {
        const dataRow = ws.addRow(r)
        section.columns.forEach((c, i) => {
          if (c.kind === 'money') dataRow.getCell(i + 1).numFmt = '#,##0.00'
        })
      }

      if (section.totals) {
        const totalsRow = ws.addRow(section.totals)
        totalsRow.font = { bold: true }
        section.columns.forEach((c, i) => {
          if (c.kind === 'money') totalsRow.getCell(i + 1).numFmt = '#,##0.00'
        })
      }

      ws.addRow([]) // spacer between sections
    }

    for (let i = 1; i <= maxCols; i += 1) ws.getColumn(i).width = 22

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
    return
  }

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
  const spec = await buildReport(String(req.query.type ?? 'year'), req.query as Record<string, unknown>)
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}.pdf"`)
  doc.pipe(res)

  const startX = 40
  const rowH = 22
  const bottomLimit = doc.page.height - 50
  // The printable width between the left/right margins. Any table whose columns are
  // wider than this would run off the right edge and get clipped, so we scale a table's
  // columns down proportionally to fit. (Narrower columns just wrap text into taller
  // rows, which the dynamic row height already handles.)
  const availableW = doc.page.width - startX * 2
  const fit = (columns: Column[]): Column[] => {
    const total = sum(columns.map((c) => c.width))
    if (total <= availableW) return columns
    const scale = availableW / total
    return columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }))
  }

  // Header band
  doc.fontSize(18).fillColor('#0f172a').text('CSR Manager', startX, 40)
  doc.fontSize(13).fillColor('#009ca6').text(spec.title, startX, 64)
  const generated = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  doc.fontSize(8).fillColor('#94a3b8').text(`Generated: ${generated}`, startX, 82)

  let y = 100

  const drawHeader = (columns: Column[]) => {
    let x = startX
    doc.rect(startX, y, sum(columns.map((c) => c.width)), rowH).fill('#009ca6')
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
    columns.forEach((c) => {
      doc.text(c.header, x + 5, y + 6, { width: c.width - 10, align: c.kind === 'text' ? 'left' : 'right' })
      x += c.width
    })
    y += rowH
  }

  const drawRow = (
    columns: Column[],
    cells: (string | number)[],
    opts: { bold?: boolean; tint?: boolean } = {},
  ) => {
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica'
    // Measure the tallest cell in this row so wrapped long text (e.g. the Master Data
    // 'Description' column holding full Schedule VII clauses) never overflows a fixed
    // 22px row and overlaps the next one. Height is content-only, so it can be computed
    // before we know y — safe to recompute after a page break.
    const maxCellHeight = Math.max(
      ...columns.map((c, i) =>
        doc.font(font).fontSize(8.5).heightOfString(fmtCell(cells[i], c.kind), { width: c.width - 10 }),
      ),
    )
    const rowHeight = Math.max(22, maxCellHeight + 8)
    if (y + rowHeight > bottomLimit) {
      doc.addPage()
      y = 50
      drawHeader(columns)
    }
    const totalW = sum(columns.map((c) => c.width))
    if (opts.tint) doc.rect(startX, y, totalW, rowHeight).fill('#f1f5f9')
    if (opts.bold) doc.rect(startX, y, totalW, rowHeight).fill('#e2e8f0')
    let x = startX
    doc.font(font).fontSize(8.5).fillColor('#0f172a')
    columns.forEach((c, i) => {
      doc.text(fmtCell(cells[i], c.kind), x + 5, y + 6, {
        width: c.width - 10,
        align: c.kind === 'text' ? 'left' : 'right',
      })
      x += c.width
    })
    y += rowHeight
  }

  if (spec.sections?.length) {
    spec.sections.forEach((section) => {
      const cols = fit(section.columns)
      // Keep a section heading from being orphaned at the very bottom of a page.
      if (y + 40 > bottomLimit) {
        doc.addPage()
        y = 50
      }
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(section.heading, startX, y)
      y += 20
      drawHeader(cols)
      section.rows.forEach((r, i) => drawRow(cols, r, { tint: i % 2 === 1 }))
      if (section.totals) drawRow(cols, section.totals, { bold: true })
      y += 12
    })
    doc.end()
    return
  }

  const cols = fit(spec.columns)
  drawHeader(cols)
  spec.rows.forEach((r, i) => drawRow(cols, r, { tint: i % 2 === 1 }))
  if (spec.totals) drawRow(cols, spec.totals, { bold: true })

  if (spec.rows.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#94a3b8').text('No records found.', startX, y + 10)
  }

  doc.end()
})
