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

// Modern chart palette: blue / green / orange / purple / cyan.
const PIE_COLORS = ['#2563EB', '#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4']

// Shared chart styling helpers (theme-aware via CSS variables resolved at render).
const axisTick = { fill: '#94a3b8', fontSize: 12 }
const gridStroke = 'rgba(148, 163, 184, 0.22)'
const tooltipStyle = {
  background: 'rgb(var(--color-surface))',
  border: '1px solid rgb(var(--color-line))',
  borderRadius: 12,
  boxShadow: 'var(--glass-shadow)',
  color: 'rgb(var(--color-ink))',
}

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: analyticsService.dashboard })

  if (!data) return <p className="text-muted">Loading…</p>

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Balance"
          value={formatINR(data.totalBalance)}
          sub={`${formatINR(data.balanceThisYear)} this year`}
          icon={<Wallet size={20} weight="fill" />}
          tint="bg-primary/10 text-primary"
        />
        <StatCard
          label="Total Received"
          value={formatINR(data.totalReceived)}
          sub={`${formatINR(data.receivedThisYear)} this year`}
          icon={<TrendingUp size={20} weight="fill" />}
          tint="bg-success/10 text-success"
        />
        <StatCard
          label="Total Expenditure"
          value={formatINR(data.totalExpenditure)}
          sub={`${formatINR(data.expenditureThisYear)} this year`}
          icon={<FileText size={20} weight="fill" />}
          tint="bg-warning/10 text-warning"
        />
        <StatCard
          label="Active Projects"
          value={String(data.activeProjects)}
          sub={`${data.completedProjects} completed, ${data.totalProjects} total`}
          icon={<Briefcase size={20} weight="fill" />}
          tint="bg-violet-500/10 text-violet-500"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 font-semibold text-ink">Year-wise Fund Overview</h2>
          <p className="mb-4 text-xs text-muted">Funds received vs. expenditure per financial year</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.yearWise} barGap={8} barCategoryGap="28%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-received" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="grad-expenditure" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: gridStroke }} tick={axisTick} dy={4} />
              <YAxis tickFormatter={formatLakhAxis} tickLine={false} axisLine={false} tick={axisTick} width={48} />
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(148,163,184,0.10)', radius: 8 }}
              />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
              <Bar dataKey="received" name="Received" fill="url(#grad-received)" radius={[8, 8, 0, 0]} maxBarSize={44} />
              <Bar dataKey="expenditure" name="Expenditure" fill="url(#grad-expenditure)" radius={[8, 8, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 font-semibold text-ink">Fund Distribution by Company</h2>
          <p className="mb-2 text-xs text-muted">Share of total funds received</p>
          <div className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.companyDistribution}
                  dataKey="received"
                  nameKey="companyName"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={106}
                  paddingAngle={4}
                  cornerRadius={6}
                  stroke="none"
                  isAnimationActive
                >
                  {data.companyDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Total Received</span>
              <span className="text-lg font-bold text-ink">{formatINR(data.totalReceived)}</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.companyDistribution.map((c, i) => (
              <div key={c.companyName} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink/80">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{c.companyName}</span>
                </span>
                <span className="shrink-0 text-muted">
                  {c.percent}% · {formatINR(c.received)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Company Fund Positions */}
      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink">Company Fund Positions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
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
                <tr
                  key={p.companyId}
                  className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink/[0.03]"
                >
                  <td className="py-3 font-medium text-ink">{p.companyName}</td>
                  <td className="py-3 text-right text-ink/80">{formatINR(p.totalReceived)}</td>
                  <td className="py-3 text-right text-muted">{formatINR(p.carryForward)}</td>
                  <td className="py-3 text-right text-ink/80">{formatINR(p.expenditure)}</td>
                  <td className="py-3 text-right font-semibold text-success">{formatINR(p.balance)}</td>
                  <td className="py-3 text-right text-ink/80">{p.projects}</td>
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
  tint,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  tint: string
}) {
  return (
    <Card className="lift p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </Card>
  )
}
