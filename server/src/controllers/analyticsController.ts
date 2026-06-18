import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { Company } from '../models/Company.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { Project } from '../models/Project.js'
import { FundReceipt } from '../models/FundReceipt.js'
import { Expenditure } from '../models/Expenditure.js'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// Load all collections once; mirrors the frontend aggregation rules exactly so the
// numbers match the reference images.
async function loadAll() {
  const [companies, years, projects, receipts, expenditures] = await Promise.all([
    Company.find().sort({ createdAt: 1 }),
    FinancialYear.find().sort({ createdAt: 1 }),
    Project.find(),
    FundReceipt.find(),
    Expenditure.find(),
  ])
  return { companies, years, projects, receipts, expenditures }
}

function companyPositions(d: Awaited<ReturnType<typeof loadAll>>) {
  return d.companies.map((c) => {
    const id = String(c._id)
    const received = sum(d.receipts.filter((r) => String(r.companyId) === id).map((r) => r.amount))
    const carryForward = sum(
      d.receipts.filter((r) => String(r.companyId) === id).map((r) => r.carryForward),
    )
    const expenditure = sum(
      d.expenditures.filter((e) => String(e.companyId) === id).map((e) => e.amount),
    )
    return {
      companyId: id,
      companyName: c.name,
      totalReceived: received,
      carryForward,
      expenditure,
      balance: received + carryForward - expenditure,
      projects: d.projects.filter((p) => String(p.companyId) === id).length,
    }
  })
}

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const d = await loadAll()
  const totalReceived = sum(d.receipts.map((r) => r.amount))
  const totalExpenditure = sum(d.expenditures.map((e) => e.amount))
  const cy = [...d.years].reverse().find((y) => y.isActive) ?? d.years.at(-1)
  const cyId = cy ? String(cy._id) : undefined

  const receivedThisYear = sum(
    d.receipts.filter((r) => String(r.financialYearId) === cyId).map((r) => r.amount),
  )
  const expenditureThisYear = sum(
    d.expenditures.filter((e) => String(e.financialYearId) === cyId).map((e) => e.amount),
  )

  const yearWise = d.years.map((y) => ({
    year: y.name.replace('FY ', ''),
    received: sum(d.receipts.filter((r) => String(r.financialYearId) === String(y._id)).map((r) => r.amount)),
    expenditure: sum(d.expenditures.filter((e) => String(e.financialYearId) === String(y._id)).map((e) => e.amount)),
  }))

  const companyDistribution = d.companies
    .map((c) => {
      const received = sum(
        d.receipts.filter((r) => String(r.companyId) === String(c._id)).map((r) => r.amount),
      )
      return {
        companyName: c.name,
        received,
        percent: totalReceived ? Math.round((received / totalReceived) * 100) : 0,
      }
    })
    .filter((x) => x.received > 0)

  res.json({
    totalBalance: totalReceived - totalExpenditure,
    totalReceived,
    totalExpenditure,
    balanceThisYear: receivedThisYear - expenditureThisYear,
    receivedThisYear,
    expenditureThisYear,
    activeProjects: d.projects.filter((p) => p.status === 'active').length,
    completedProjects: d.projects.filter((p) => p.status === 'completed').length,
    totalProjects: d.projects.length,
    yearWise,
    companyDistribution,
    companyPositions: companyPositions(d),
  })
})

export const getCompanyPositions = asyncHandler(async (_req: Request, res: Response) => {
  res.json(companyPositions(await loadAll()))
})

export const getYearWiseReport = asyncHandler(async (_req: Request, res: Response) => {
  const d = await loadAll()
  const rows = d.years.map((y) => {
    const id = String(y._id)
    const fundsReceived = sum(d.receipts.filter((r) => String(r.financialYearId) === id).map((r) => r.amount))
    const carryForwardIn = sum(d.receipts.filter((r) => String(r.financialYearId) === id).map((r) => r.carryForward))
    const expenditure = sum(d.expenditures.filter((e) => String(e.financialYearId) === id).map((e) => e.amount))
    const totalAvailable = fundsReceived + carryForwardIn
    const balance = totalAvailable - expenditure
    return {
      financialYearId: id,
      yearName: y.name,
      fundsReceived,
      carryForwardIn,
      totalAvailable,
      expenditure,
      balance,
      carryForwardOut: balance,
    }
  })
  res.json(rows)
})
