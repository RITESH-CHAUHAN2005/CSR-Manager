import { useQuery } from '@tanstack/react-query'
import { Briefcase, FileText, Receipt, UserCircle } from '../components/icons'
import {
  expenditureService,
  fundReceiptService,
  logService,
  projectService,
} from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import { Card, PageHeader } from '../components/ui'
import { DataTable, type DTColumn } from '../components/DataTable'
import { formatDate, formatINR } from '../lib/currency'
import { describeLog, formatTimestamp } from '../lib/activity'

export default function UserDashboard() {
  const { user } = useAuth()
  const mine = (createdById?: string) => createdById === user?.id

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectService.list })
  const { data: receipts = [] } = useQuery({ queryKey: ['fund-receipts'], queryFn: fundReceiptService.list })
  const { data: expenditures = [] } = useQuery({ queryKey: ['expenditures'], queryFn: expenditureService.list })
  const { data: myLogs = [] } = useQuery({ queryKey: ['logs', 'mine'], queryFn: logService.mine })

  const myProjects = projects.filter((p) => mine(p.createdById))
  const myReceipts = receipts.filter((r) => mine(r.createdById))
  const myExpenditures = expenditures.filter((e) => mine(e.createdById))

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? 'User'}`} subtitle="Your activity & records" />

      {/* Profile */}
      <Card className="mb-6 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserCircle size={36} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-ink">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs text-muted">Role</p>
          <span className="inline-flex rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-accent-dark">
            {user?.role ?? 'editor'}
          </span>
        </div>
      </Card>

      {/* My counts */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="My Projects" value={String(myProjects.length)} icon={<Briefcase size={18} />} />
        <Stat label="My Fund Receipts" value={String(myReceipts.length)} icon={<FileText size={18} />} />
        <Stat label="My Expenditures" value={String(myExpenditures.length)} icon={<Receipt size={18} />} />
      </div>

      {/* My records */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-ink">My Records</h2>
        {myProjects.length + myReceipts.length + myExpenditures.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            You haven't created any records yet. Add a project, fund receipt, or expenditure to get started.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {myProjects.map((p) => (
              <Row key={p.id} type="Project" label={p.name} value={formatINR(p.budget)} />
            ))}
            {myReceipts.map((r) => (
              <Row key={r.id} type="Receipt" label={r.reference} value={formatINR(r.amount)} />
            ))}
            {myExpenditures.map((e) => (
              <Row key={e.id} type="Expenditure" label={e.description || formatDate(e.date)} value={formatINR(e.amount)} />
            ))}
          </div>
        )}
      </Card>

      {/* My activity */}
      <Card className="p-2 sm:p-4">
        <h2 className="mb-4 px-3 pt-3 font-semibold text-ink">My Activity</h2>
        <DataTable
          data={myLogs.map((l) => ({
            ...l,
            activityLabel: describeLog(l),
          }))}
          columns={[
            {
              data: 'createdAt',
              title: 'When',
              render: (d: unknown, type: string) =>
                type === 'display' ? formatTimestamp(String(d)) : d,
            },
            { data: 'activityLabel', title: 'Activity' },
          ] as DTColumn[]}
          options={{ order: [] }}
        />
      </Card>
    </>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="lift p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </Card>
  )
}

function Row({ type, label, value }: { type: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line/60 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{type}</span>
        <span className="text-ink/80">{label}</span>
      </div>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}
