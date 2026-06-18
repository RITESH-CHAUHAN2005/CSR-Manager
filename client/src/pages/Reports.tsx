import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FileDown, FileText } from '../components/icons'
import {
  companyService,
  expenditureService,
  financialYearService,
  fundReceiptService,
  projectService,
} from '../services/dataService'
import { formatINR, formatLakhAxis } from '../lib/currency'
import { Card, PageHeader, Select } from '../components/ui'
import { downloadCsv, printReport } from '../lib/exporters'

type Tab = 'year' | 'company' | 'project'
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export default function Reports() {
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: companyService.list })
  const { data: years = [] } = useQuery({ queryKey: ['financial-years'], queryFn: financialYearService.list })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })

  const [tab, setTab] = useState<Tab>('year')
  const [companyFilter, setCompanyFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  const fr = useMemo(
    () =>
      receipts.filter(
        (r) =>
          (!companyFilter || r.companyId === companyFilter) &&
          (!yearFilter || r.financialYearId === yearFilter),
      ),
    [receipts, companyFilter, yearFilter],
  )
  const ex = useMemo(
    () =>
      expenditures.filter(
        (e) =>
          (!companyFilter || e.companyId === companyFilter) &&
          (!yearFilter || e.financialYearId === yearFilter),
      ),
    [expenditures, companyFilter, yearFilter],
  )

  // ---- Year-wise rows ----
  const yearRows = useMemo(() => {
    const list = years.filter((y) => !yearFilter || y.id === yearFilter)
    return list.map((y) => {
      const fundsReceived = sum(fr.filter((r) => r.financialYearId === y.id).map((r) => r.amount))
      const carryForwardIn = sum(fr.filter((r) => r.financialYearId === y.id).map((r) => r.carryForward))
      const expenditure = sum(ex.filter((e) => e.financialYearId === y.id).map((e) => e.amount))
      const totalAvailable = fundsReceived + carryForwardIn
      const balance = totalAvailable - expenditure
      return { name: y.name, fundsReceived, carryForwardIn, totalAvailable, expenditure, balance, carryForwardOut: balance }
    })
  }, [years, fr, ex, yearFilter])

  const yearTotals = {
    fundsReceived: sum(yearRows.map((r) => r.fundsReceived)),
    carryForwardIn: sum(yearRows.map((r) => r.carryForwardIn)),
    totalAvailable: sum(yearRows.map((r) => r.totalAvailable)),
    expenditure: sum(yearRows.map((r) => r.expenditure)),
    balance: sum(yearRows.map((r) => r.balance)),
    carryForwardOut: sum(yearRows.map((r) => r.carryForwardOut)),
  }

  // ---- Company-wise rows ----
  const companyRows = useMemo(
    () =>
      companies
        .filter((c) => !companyFilter || c.id === companyFilter)
        .map((c) => {
          const received = sum(fr.filter((r) => r.companyId === c.id).map((r) => r.amount))
          const carry = sum(fr.filter((r) => r.companyId === c.id).map((r) => r.carryForward))
          const expenditure = sum(ex.filter((e) => e.companyId === c.id).map((e) => e.amount))
          return {
            name: c.name,
            received,
            carry,
            expenditure,
            balance: received + carry - expenditure,
            projects: projects.filter((p) => p.companyId === c.id).length,
          }
        }),
    [companies, fr, ex, projects, companyFilter],
  )

  // ---- Project-wise rows ----
  const projectRows = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            (!companyFilter || p.companyId === companyFilter) &&
            (!yearFilter || p.financialYearId === yearFilter),
        )
        .map((p) => {
          const spent = sum(ex.filter((e) => e.projectId === p.id).map((e) => e.amount))
          return {
            name: p.name,
            company: companies.find((c) => c.id === p.companyId)?.name ?? '—',
            year: years.find((y) => y.id === p.financialYearId)?.name ?? '—',
            budget: p.budget,
            spent,
            utilization: p.budget ? Math.round((spent / p.budget) * 100) : 0,
            status: p.status,
          }
        }),
    [projects, ex, companies, years, companyFilter, yearFilter],
  )

  function exportExcel() {
    if (tab === 'year') {
      downloadCsv('year-wise-report', ['Financial Year', 'Funds Received', 'Carry Forward In', 'Total Available', 'Expenditure', 'Balance', 'Carry Forward Out'],
        yearRows.map((r) => [r.name, r.fundsReceived, r.carryForwardIn, r.totalAvailable, r.expenditure, r.balance, r.carryForwardOut]))
    } else if (tab === 'company') {
      downloadCsv('company-wise-report', ['Company', 'Received', 'Carry Forward', 'Expenditure', 'Balance', 'Projects'],
        companyRows.map((r) => [r.name, r.received, r.carry, r.expenditure, r.balance, r.projects]))
    } else {
      downloadCsv('project-wise-report', ['Project', 'Company', 'Year', 'Budget', 'Spent', 'Utilization %', 'Status'],
        projectRows.map((r) => [r.name, r.company, r.year, r.budget, r.spent, r.utilization, r.status]))
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={[
        'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <>
      <PageHeader
        title="Financial Reports"
        action={
          <div className="flex gap-3">
            <button onClick={printReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <FileText size={16} /> Export PDF
            </button>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark">
              <FileDown size={16} /> Export Excel
            </button>
          </div>
        }
      />

      <div className="mb-5 flex gap-3">
        <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </Select>
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabBtn('year', 'Year-wise Summary')}
        {tabBtn('company', 'Company-wise Summary')}
        {tabBtn('project', 'Project-wise Summary')}
      </div>

      <div id="report-printable">
        {tab === 'year' && (
          <>
            <Card className="mb-6 p-5">
              <h2 className="mb-4 font-semibold text-slate-800">Fund Flow by Financial Year</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={yearRows} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} fontSize={12} />
                  <YAxis tickFormatter={formatLakhAxis} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Legend />
                  <Bar dataKey="fundsReceived" name="Received" fill="#009ca6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="carryForwardIn" name="Carry In" fill="#80cdd2" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenditure" name="Expenditure" fill="#f58220" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">Financial Year</th>
                    <Th>Funds Received</Th>
                    <Th>Carry Forward In</Th>
                    <Th>Total Available</Th>
                    <Th>Expenditure</Th>
                    <Th>Balance</Th>
                    <Th>Carry Forward Out</Th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map((r) => (
                    <tr key={r.name} className="border-b border-slate-100">
                      <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                      <Td>{formatINR(r.fundsReceived)}</Td>
                      <Td>{formatINR(r.carryForwardIn)}</Td>
                      <Td>{formatINR(r.totalAvailable)}</Td>
                      <Td className="text-danger">{formatINR(r.expenditure)}</Td>
                      <Td className="text-success">{formatINR(r.balance)}</Td>
                      <Td>{formatINR(r.carryForwardOut)}</Td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-5 py-3 text-slate-800">Total</td>
                    <Td>{formatINR(yearTotals.fundsReceived)}</Td>
                    <Td>{formatINR(yearTotals.carryForwardIn)}</Td>
                    <Td>{formatINR(yearTotals.totalAvailable)}</Td>
                    <Td className="text-danger">{formatINR(yearTotals.expenditure)}</Td>
                    <Td className="text-success">{formatINR(yearTotals.balance)}</Td>
                    <Td>{formatINR(yearTotals.carryForwardOut)}</Td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </>
        )}

        {tab === 'company' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <Th>Total Received</Th>
                  <Th>Carry Forward</Th>
                  <Th>Expenditure</Th>
                  <Th>Balance</Th>
                  <Th>Projects</Th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                    <Td>{formatINR(r.received)}</Td>
                    <Td>{formatINR(r.carry)}</Td>
                    <Td className="text-danger">{formatINR(r.expenditure)}</Td>
                    <Td className="text-success">{formatINR(r.balance)}</Td>
                    <Td>{r.projects}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'project' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Year</th>
                  <Th>Budget</Th>
                  <Th>Spent</Th>
                  <Th>Utilization</Th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="px-5 py-3 text-slate-500">{r.company}</td>
                    <td className="px-5 py-3 text-slate-500">{r.year}</td>
                    <Td>{formatINR(r.budget)}</Td>
                    <Td className="text-danger">{formatINR(r.spent)}</Td>
                    <Td>{r.utilization}%</Td>
                    <td className="px-5 py-3 capitalize text-slate-600">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-right font-medium">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3 text-right text-slate-700 ${className}`}>{children}</td>
}
