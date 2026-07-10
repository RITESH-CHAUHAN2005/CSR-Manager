import { useQuery } from '@tanstack/react-query'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as CJLegend,
  LinearScale,
  Tooltip as CJTooltip,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Briefcase, FileText, TrendingUp, Wallet } from '../components/icons'
import { analyticsService } from '../services/dataService'
import { formatINR, formatLakhAxis } from '../lib/currency'
import { CHART_COLORS, CHART_PALETTE } from '../lib/chartColors'
import { Card } from '../components/ui'
import { DataTable } from '../components/DataTable'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, CJTooltip, CJLegend)

// Shared with Reports.tsx so a company/series reads the same color on every page.
const PIE_COLORS = CHART_PALETTE
const AXIS = '#94a3b8'
const GRID = 'rgba(148, 163, 184, 0.18)'

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: analyticsService.dashboard })

  if (!data) return <p className="text-muted">Loading…</p>

  const barData = {
    labels: data.yearWise.map((y) => y.year),
    datasets: [
      {
        label: 'Received',
        data: data.yearWise.map((y) => y.received),
        backgroundColor: CHART_COLORS.received,
        borderRadius: 8,
        maxBarThickness: 44,
      },
      {
        label: 'Expenditure',
        data: data.yearWise.map((y) => y.expenditure),
        backgroundColor: CHART_COLORS.expenditure,
        borderRadius: 8,
        maxBarThickness: 44,
      },
    ],
  }
  const barOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, pointStyle: 'circle', color: AXIS, boxWidth: 8, font: { size: 13 } },
      },
      tooltip: {
        callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => ` ${c.dataset.label}: ${formatINR(c.parsed.y)}` },
        padding: 10,
        cornerRadius: 10,
      },
      datalabels: { display: false },
    },
    scales: {
      x: { grid: { display: false }, border: { color: GRID }, ticks: { color: AXIS } },
      y: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: AXIS, callback: (v: string | number) => formatLakhAxis(Number(v)) },
      },
    },
  }

  const pieData: any = {
    labels: data.companyDistribution.map((c) => c.companyName),
    datasets: [
      {
        data: data.companyDistribution.map((c) => c.received),
        backgroundColor: data.companyDistribution.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderColor: 'rgb(var(--color-surface))',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  }
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (c: { label?: string; parsed: number }) => ` ${c.label}: ${formatINR(c.parsed)}` },
        padding: 10,
        cornerRadius: 10,
      },
      datalabels: { display: false },
    },
  }

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
          <div className="h-[300px]">
            <Bar data={barData} options={barOptions} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 font-semibold text-ink">Fund Distribution by Company</h2>
          <p className="mb-2 text-xs text-muted">Share of total funds received</p>
          <div className="relative h-[240px]">
            <Doughnut data={pieData} options={pieOptions} />
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
        <DataTable
          data={data.companyPositions}
          columns={[
            { data: 'companyName', title: 'Company' },
            { data: 'totalReceived', title: 'Total Received', className: 'text-right', render: money },
            { data: 'carryForward', title: 'Carry Forward', className: 'text-right', render: money },
            { data: 'expenditure', title: 'Expenditure', className: 'text-right', render: money },
            { data: 'balance', title: 'Balance', className: 'text-right' },
            { data: 'projects', title: 'Projects', className: 'text-right' },
          ]}
          slots={{
            4: (_v, row) => (
              <span className="font-semibold text-success">{formatINR((row as { balance: number }).balance)}</span>
            ),
          }}
          options={{ order: [[1, 'desc']] }}
        />
      </Card>
    </>
  )
}

// DataTables render: format currency for display, keep the raw number for sorting.
function money(d: unknown, type: string) {
  return type === 'display' ? formatINR(Number(d)) : (d as number)
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
