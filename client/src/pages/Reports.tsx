import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileDown, FileText } from "../components/icons";
import {
  analyticsService,
  companyService,
  expenditureService,
  financialYearService,
  fundReceiptService,
  projectService,
} from "../services/dataService";
import { USE_API } from "../services/api";
import { formatINR, formatLakhAxis } from "../lib/currency";
import { Card, PageHeader, Select } from "../components/ui";
import { downloadCsv, printReport, saveBlob } from "../lib/exporters";
import { useAuth } from "../context/AuthContext";

type Tab = "year" | "company" | "project";
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function Reports() {
  const { canWrite } = useAuth();
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: companyService.list,
  });
  const { data: years = [] } = useQuery({
    queryKey: ["financial-years"],
    queryFn: financialYearService.list,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectService.list,
  });
  const { data: receipts = [] } = useQuery({
    queryKey: ["fund-receipts"],
    queryFn: fundReceiptService.list,
  });
  const { data: expenditures = [] } = useQuery({
    queryKey: ["expenditures"],
    queryFn: expenditureService.list,
  });

  const [tab, setTab] = useState<Tab>("year");
  const [companyFilter, setCompanyFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const fr = useMemo(
    () =>
      receipts.filter(
        (r) =>
          (!companyFilter || r.companyId === companyFilter) &&
          (!yearFilter || r.financialYearId === yearFilter),
      ),
    [receipts, companyFilter, yearFilter],
  );
  const ex = useMemo(
    () =>
      expenditures.filter(
        (e) =>
          (!companyFilter || e.companyId === companyFilter) &&
          (!yearFilter || e.financialYearId === yearFilter),
      ),
    [expenditures, companyFilter, yearFilter],
  );

  // ---- Year-wise rows ----
  const yearRows = useMemo(() => {
    const list = years.filter((y) => !yearFilter || y.id === yearFilter);
    return list.map((y) => {
      const fundsReceived = sum(
        fr.filter((r) => r.financialYearId === y.id).map((r) => r.amount),
      );
      const carryForwardIn = sum(
        fr.filter((r) => r.financialYearId === y.id).map((r) => r.carryForward),
      );
      const expenditure = sum(
        ex.filter((e) => e.financialYearId === y.id).map((e) => e.amount),
      );
      const totalAvailable = fundsReceived + carryForwardIn;
      const balance = totalAvailable - expenditure;
      return {
        name: y.name,
        fundsReceived,
        carryForwardIn,
        totalAvailable,
        expenditure,
        balance,
        carryForwardOut: balance,
      };
    });
  }, [years, fr, ex, yearFilter]);

  const yearTotals = {
    fundsReceived: sum(yearRows.map((r) => r.fundsReceived)),
    carryForwardIn: sum(yearRows.map((r) => r.carryForwardIn)),
    totalAvailable: sum(yearRows.map((r) => r.totalAvailable)),
    expenditure: sum(yearRows.map((r) => r.expenditure)),
    balance: sum(yearRows.map((r) => r.balance)),
    carryForwardOut: sum(yearRows.map((r) => r.carryForwardOut)),
  };

  // ---- Company-wise rows ----
  const companyRows = useMemo(
    () =>
      companies
        .filter((c) => !companyFilter || c.id === companyFilter)
        .map((c) => {
          const received = sum(
            fr.filter((r) => r.companyId === c.id).map((r) => r.amount),
          );
          const carry = sum(
            fr.filter((r) => r.companyId === c.id).map((r) => r.carryForward),
          );
          const expenditure = sum(
            ex.filter((e) => e.companyId === c.id).map((e) => e.amount),
          );
          return {
            name: c.name,
            received,
            carry,
            expenditure,
            balance: received + carry - expenditure,
            projects: projects.filter((p) => p.companyId === c.id).length,
          };
        }),
    [companies, fr, ex, projects, companyFilter],
  );

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
          const spent = sum(
            ex.filter((e) => e.projectId === p.id).map((e) => e.amount),
          );
          return {
            name: p.name,
            company: companies.find((c) => c.id === p.companyId)?.name ?? "—",
            year: years.find((y) => y.id === p.financialYearId)?.name ?? "—",
            budget: p.budget,
            spent,
            utilization: p.budget ? Math.round((spent / p.budget) * 100) : 0,
            status: p.status,
          };
        }),
    [projects, ex, companies, years, companyFilter, yearFilter],
  );

  // Proper server-generated PDF/Excel of the active report. Falls back to the
  // client-side CSV / print path when the API isn't available (offline mock mode).
  async function onExport(format: "pdf" | "excel") {
    if (!USE_API) {
      if (format === "pdf") printReport();
      else exportExcelCsv();
      return;
    }
    setExporting(format);
    try {
      const blob = await analyticsService.exportReport(tab, format);
      saveBlob(blob, `${tab}-wise-report.${format === "pdf" ? "pdf" : "xlsx"}`);
    } catch {
      if (format === "pdf") printReport();
      else exportExcelCsv();
    } finally {
      setExporting(null);
    }
  }

  function exportExcelCsv() {
    if (tab === "year") {
      downloadCsv(
        "year-wise-report",
        [
          "Financial Year",
          "Funds Received",
          "Carry Forward In",
          "Total Available",
          "Expenditure",
          "Balance",
          "Carry Forward Out",
        ],
        yearRows.map((r) => [
          r.name,
          r.fundsReceived,
          r.carryForwardIn,
          r.totalAvailable,
          r.expenditure,
          r.balance,
          r.carryForwardOut,
        ]),
      );
    } else if (tab === "company") {
      downloadCsv(
        "company-wise-report",
        [
          "Company",
          "Received",
          "Carry Forward",
          "Expenditure",
          "Balance",
          "Projects",
        ],
        companyRows.map((r) => [
          r.name,
          r.received,
          r.carry,
          r.expenditure,
          r.balance,
          r.projects,
        ]),
      );
    } else {
      downloadCsv(
        "project-wise-report",
        [
          "Project",
          "Company",
          "Year",
          "Budget",
          "Spent",
          "Utilization %",
          "Status",
        ],
        projectRows.map((r) => [
          r.name,
          r.company,
          r.year,
          r.budget,
          r.spent,
          r.utilization,
          r.status,
        ]),
      );
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={[
        "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Financial Reports"
        action={
          canWrite && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onExport("pdf")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-ink/5 disabled:opacity-50"
              >
                <FileText size={16} /> {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </button>
              <button
                onClick={() => onExport("excel")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark disabled:opacity-50"
              >
                <FileDown size={16} /> {exporting === "excel" ? "Exporting…" : "Export Excel"}
              </button>
            </div>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-5 flex gap-1 border-b border-line">
        {tabBtn("year", "Year-wise Summary")}
        {tabBtn("company", "Company-wise Summary")}
        {tabBtn("project", "Project-wise Summary")}
      </div>

      <div id="report-printable">
        {tab === "year" && (
          <>
            <Card className="mb-6 p-5">
              <h2 className="mb-4 font-semibold text-ink">
                Fund Flow by Financial Year
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={yearRows} barGap={6} barCategoryGap="24%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rep-received" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id="rep-carry" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93C5FD" />
                      <stop offset="100%" stopColor="#60A5FA" />
                    </linearGradient>
                    <linearGradient id="rep-exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="rgba(148,163,184,0.22)"
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "rgba(148,163,184,0.22)" }}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={formatLakhAxis}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{
                      background: "rgb(var(--color-surface))",
                      border: "1px solid rgb(var(--color-line))",
                      borderRadius: 12,
                      color: "rgb(var(--color-ink))",
                    }}
                  />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
                  <Bar
                    dataKey="fundsReceived"
                    name="Received"
                    fill="url(#rep-received)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="carryForwardIn"
                    name="Carry In"
                    fill="url(#rep-carry)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="expenditure"
                    name="Expenditure"
                    fill="url(#rep-exp)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-line bg-surface/85 text-left text-xs uppercase tracking-wide text-muted backdrop-blur">
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
                    <tr key={r.name} className="border-b border-line/60 transition-colors hover:bg-ink/[0.03]">
                      <td className="px-5 py-3 font-medium text-ink">
                        {r.name}
                      </td>
                      <Td>{formatINR(r.fundsReceived)}</Td>
                      <Td>{formatINR(r.carryForwardIn)}</Td>
                      <Td>{formatINR(r.totalAvailable)}</Td>
                      <Td className="text-danger">
                        {formatINR(r.expenditure)}
                      </Td>
                      <Td className="text-success">{formatINR(r.balance)}</Td>
                      <Td>{formatINR(r.carryForwardOut)}</Td>
                    </tr>
                  ))}
                  <tr className="bg-ink/[0.03] font-semibold">
                    <td className="px-5 py-3 text-ink">Total</td>
                    <Td>{formatINR(yearTotals.fundsReceived)}</Td>
                    <Td>{formatINR(yearTotals.carryForwardIn)}</Td>
                    <Td>{formatINR(yearTotals.totalAvailable)}</Td>
                    <Td className="text-danger">
                      {formatINR(yearTotals.expenditure)}
                    </Td>
                    <Td className="text-success">
                      {formatINR(yearTotals.balance)}
                    </Td>
                    <Td>{formatINR(yearTotals.carryForwardOut)}</Td>
                  </tr>
                </tbody>
              </table>
              </div>
            </Card>
          </>
        )}

        {tab === "company" && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-line bg-surface/85 text-left text-xs uppercase tracking-wide text-muted backdrop-blur">
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
                  <tr
                    key={r.name}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink/[0.03]"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {r.name}
                    </td>
                    <Td>{formatINR(r.received)}</Td>
                    <Td>{formatINR(r.carry)}</Td>
                    <Td className="text-danger">{formatINR(r.expenditure)}</Td>
                    <Td className="text-success">{formatINR(r.balance)}</Td>
                    <Td>{r.projects}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}

        {tab === "project" && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-line bg-surface/85 text-left text-xs uppercase tracking-wide text-muted backdrop-blur">
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
                  <tr
                    key={r.name}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink/[0.03]"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {r.name}
                    </td>
                    <td className="px-5 py-3 text-muted">{r.company}</td>
                    <td className="px-5 py-3 text-muted">{r.year}</td>
                    <Td>{formatINR(r.budget)}</Td>
                    <Td className="text-danger">{formatINR(r.spent)}</Td>
                    <Td>{r.utilization}%</Td>
                    <td className="px-5 py-3 capitalize text-ink/80">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-right font-medium">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 text-right text-ink/80 ${className}`}>
      {children}
    </td>
  );
}
