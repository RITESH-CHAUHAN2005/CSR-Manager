import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Briefcase, FileText, TrendingUp, Wallet } from '../components/icons'
import { analyticsService } from '../services/dataService'
import { formatINR, formatLakhAxis } from '../lib/currency'
import { Card } from '../components/ui'

// Teal/orange palette for charts (matches theme.css brand + accent).
const RECEIVED = '#009ca6' // teal (brand)
const EXPENDITURE = '#f58220' // orange (accent)
const PIE_COLORS = ['#009ca6', '#4dbcc4', '#80cdd2', '#008089', '#b3e0e3']

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: analyticsService.dashboard })

  if (!data) return <p className="text-slate-500">Loading…</p>

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Balance"
          value={formatINR(data.totalBalance)}
          sub={`${formatINR(data.balanceThisYear)} this year`}
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Total Received"
          value={formatINR(data.totalReceived)}
          sub={`${formatINR(data.receivedThisYear)} this year`}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Total Expenditure"
          value={formatINR(data.totalExpenditure)}
          sub={`${formatINR(data.expenditureThisYear)} this year`}
          icon={<FileText size={18} />}
        />
        <StatCard
          label="Active Projects"
          value={String(data.activeProjects)}
          sub={`${data.completedProjects} completed, ${data.totalProjects} total`}
          icon={<Briefcase size={18} />}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Year-wise Fund Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.yearWise} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} fontSize={12} />
              <YAxis tickFormatter={formatLakhAxis} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Legend />
              <Bar dataKey="received" name="Received" fill={RECEIVED} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenditure" name="Expenditure" fill={EXPENDITURE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Fund Distribution by Company</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.companyDistribution}
                dataKey="received"
                nameKey="companyName"
                cx="50%"
                cy="50%"
                outerRadius={100}
                isAnimationActive={false}
                label={({ companyName, percent }) =>
                  `${String(companyName).split(' ')[0]} ${Math.round((percent as number) * 100)}%`
                }
                labelLine={false}
              >
                {data.companyDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Company Fund Positions */}
      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-800">Company Fund Positions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 font-medium">Company</th>
                <th className="pb-3 text-right font-medium">Total Received</th>
                <th className="pb-3 text-right font-medium">Carry Forward</th>
                <th className="pb-3 text-right font-medium">Expenditure</th>
                <th className="pb-3 text-right font-medium">Balance</th>
                <th className="pb-3 text-right font-medium">Projects</th>
              </tr>
            </thead>
            <tbody>
              {data.companyPositions.map((p) => (
                <tr key={p.companyId} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 font-medium text-slate-800">{p.companyName}</td>
                  <td className="py-3 text-right text-slate-700">{formatINR(p.totalReceived)}</td>
                  <td className="py-3 text-right text-slate-500">{formatINR(p.carryForward)}</td>
                  <td className="py-3 text-right text-slate-700">{formatINR(p.expenditure)}</td>
                  <td className="py-3 text-right font-medium text-success">{formatINR(p.balance)}</td>
                  <td className="py-3 text-right text-slate-700">{p.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="text-slate-300">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </Card>
  )
}
