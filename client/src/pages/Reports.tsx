import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as CJLegend,
  LinearScale,
  Tooltip as CJTooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Pie } from "react-chartjs-2";
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
import { formatDate, formatINR, formatLakhAxis } from "../lib/currency";
import { findCurrentFinancialYear } from "../lib/financialYear";
import { committedTotal, contributionsForProject, receivedTotal } from "../lib/projectContributions";
import { CHART_COLORS, colorFor } from "../lib/chartColors";
import { Card, PageHeader, Select, StatusBadge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { downloadCsv, printReport, saveBlob } from "../lib/exporters";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, CJTooltip, CJLegend, ChartDataLabels);

type Tab = "year" | "company" | "project" | "carryForward" | "ledger";
const dateCell = (d: unknown, type: string) => (type === "display" ? formatDate(String(d)) : d);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const money = (d: unknown, type: string) =>
  type === "display" ? formatINR(Number(d)) : Number(d);

const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  completed: "#2563EB",
  on_hold: "#F59E0B",
  cancelled: "#EF4444",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

function moneyBarOptions({ rotateLabels = false }: { rotateLabels?: boolean } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { usePointStyle: true, pointStyle: "circle", color: "#94a3b8", boxWidth: 8, font: { size: 13 } } },
      tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${formatINR(c.parsed.y)}` }, padding: 10, cornerRadius: 10 },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: "rgba(148,163,184,0.22)" },
        ticks: rotateLabels
          ? { color: "#94a3b8", maxRotation: 40, minRotation: 40, autoSkip: false, font: { size: 11 } }
          : { color: "#94a3b8" },
      },
      y: { grid: { color: "rgba(148,163,184,0.18)" }, border: { display: false }, ticks: { color: "#94a3b8", callback: (v: any) => formatLakhAxis(Number(v)) } },
    },
  } as any;
}

function pieOptions(formatValue: (v: number) => string = formatINR) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { usePointStyle: true, pointStyle: "circle", color: "#94a3b8", boxWidth: 8, padding: 12, font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (c: any) => {
            const val = Number(c.parsed);
            const total = (c.dataset.data as number[]).reduce((a, b) => a + Number(b), 0);
            const pct = total ? Math.round((val / total) * 100) : 0;
            return ` ${c.label}: ${formatValue(val)} (${pct}%)`;
          },
        },
        padding: 10,
        cornerRadius: 10,
      },
      datalabels: {
        color: "#fff",
        font: { size: 12, weight: "bold" as const },
        formatter: (val: number, ctx: any) => {
          const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + Number(b), 0);
          const pct = total ? Math.round((Number(val) / total) * 100) : 0;
          return pct > 0 ? `${pct}%` : "";
        },
        textStrokeColor: "rgba(0,0,0,0.35)",
        textStrokeWidth: 3,
      },
    },
  } as any;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold text-ink">{title}</h2>
      <div className="h-[320px]">{children}</div>
    </Card>
  );
}

function EmptyChartNote({ text = "No data to display yet." }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted">{text}</div>;
}

export default function Reports() {
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
      const carryForwardIn =
        sum(fr.filter((r) => r.financialYearId === y.id).map((r) => r.carryForward ?? 0)) +
        sum(ex.filter((e) => e.financialYearId === y.id).map((e) => e.carryForwardAmount ?? 0));
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
          const carry =
            sum(fr.filter((r) => r.companyId === c.id).map((r) => r.carryForward ?? 0)) +
            sum(ex.filter((e) => e.companyId === c.id).map((e) => e.carryForwardAmount ?? 0));
          const expenditure = sum(
            ex.filter((e) => e.companyId === c.id).map((e) => e.amount),
          );
          return {
            name: c.name,
            received,
            carry,
            expenditure,
            balance: received + carry - expenditure,
            projects: projects.filter((p) => p.companyIds?.includes(c.id)).length,
          };
        }),
    [companies, fr, ex, projects, companyFilter],
  );

  // ---- Project-wise rows ----
  const projectRows = useMemo(
    () =>
      projects
        .filter((p) => !companyFilter || p.companyIds?.includes(companyFilter))
        .map((p) => {
          const spent = sum(
            ex.filter((e) => e.projectId === p.id).map((e) => e.amount),
          );
          const companyNames =
            companies
              .filter((c) => p.companyIds?.includes(c.id))
              .map((c) => c.name)
              .join(", ") || "—";
          const period = p.derivedStatus === "ongoing"
            ? `${p.startDate ?? ""} – Ongoing`
            : [p.startDate, p.endDate].filter(Boolean).join(" – ");
          return {
            name: p.name,
            company: companyNames,
            period,
            budget: p.budget,
            // Pledged by the contributing companies vs what has actually landed.
            // Utilization stays budget-based: it measures the approved cost consumed.
            committed: committedTotal(p),
            received: receivedTotal(p.id, receipts),
            spent,
            utilization: p.budget ? Math.round((spent / p.budget) * 100) : 0,
            status: p.status,
          };
        }),
    [projects, ex, receipts, companies, companyFilter],
  );

  // ---- Carry Forward rows (per Ongoing project, split by contributing company) ----
  const currentFy = useMemo(() => findCurrentFinancialYear(years), [years]);
  const rollsIntoFy = useMemo(() => {
    if (!currentFy) return "—";
    const upcoming = years
      .filter((y) => y.startDate > currentFy.endDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return upcoming[0]?.name ?? "—";
  }, [years, currentFy]);

  const carryForwardRows = useMemo(() => {
    const rows: { project: string; company: string; pct: number | null; share: number; rollsInto: string }[] = [];
    projects
      .filter((p) => p.derivedStatus === "ongoing")
      .filter((p) => !companyFilter || p.companyIds?.includes(companyFilter))
      .forEach((p) => {
        const projectCF = sum(ex.filter((e) => e.projectId === p.id).map((e) => e.carryForwardAmount ?? 0));
        if (projectCF <= 0) return;
        // Derived from actual Fund Receipts against this project, not a manually
        // entered figure — the single source of truth for "who put in how much".
        const contributions = contributionsForProject(p.id, receipts);
        const totalContrib = sum(contributions.map((c) => c.amount || 0));
        if (totalContrib <= 0) {
          rows.push({ project: p.name, company: "Unattributed", pct: null, share: projectCF, rollsInto: rollsIntoFy });
          return;
        }
        contributions
          .filter((c) => c.amount > 0)
          .forEach((c) => {
            rows.push({
              project: p.name,
              company: companies.find((co) => co.id === c.companyId)?.name ?? "—",
              pct: Math.round((c.amount / totalContrib) * 100),
              share: projectCF * (c.amount / totalContrib),
              rollsInto: rollsIntoFy,
            });
          });
      });
    return rows;
  }, [projects, ex, receipts, companies, companyFilter, rollsIntoFy]);

  // ---- Transaction Ledger rows (flat chronological merge, running balance) ----
  const ledgerRows = useMemo(() => {
    type Row = {
      type: "receipt" | "expenditure";
      date: string;
      company: string;
      project: string;
      fy: string;
      baseAmount: number;
      carryForward: number;
    };
    const receiptRows: Row[] = fr.map((r) => ({
      type: "receipt",
      date: r.date,
      company:
        r.receiptType === "other_source"
          ? r.companyId
            ? `${r.source || "Other Source"} — ${companies.find((c) => c.id === r.companyId)?.name ?? "—"}`
            : r.source || "Other Source"
          : companies.find((c) => c.id === r.companyId)?.name ?? "—",
      project: r.projectId ? projects.find((p) => p.id === r.projectId)?.name ?? "—" : "—",
      fy: years.find((y) => y.id === r.financialYearId)?.name ?? "—",
      baseAmount: r.amount,
      carryForward: r.carryForward ?? 0,
    }));
    const expenditureRows: Row[] = ex.map((e) => ({
      type: "expenditure",
      date: e.date,
      company: companies.find((c) => c.id === e.companyId)?.name ?? "—",
      project: projects.find((p) => p.id === e.projectId)?.name ?? "—",
      fy: years.find((y) => y.id === e.financialYearId)?.name ?? "—",
      baseAmount: e.amount,
      carryForward: e.carryForwardAmount ?? 0,
    }));
    let running = 0;
    return [...receiptRows, ...expenditureRows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        running += row.type === "receipt" ? row.baseAmount : -row.baseAmount;
        return { ...row, runningBalance: running };
      });
  }, [fr, ex, companies, projects, years]);

  const ledgerTotals = {
    totalReceipts: sum(fr.map((r) => r.amount)),
    totalExpenditures: sum(ex.map((e) => e.amount)),
    netBalance: sum(fr.map((r) => r.amount)) - sum(ex.map((e) => e.amount)),
  };

  // ---- Chart datasets (real backend-derived rows, same source as the tables) ----
  const yearPie = useMemo(() => {
    const rows = yearRows.filter((r) => r.expenditure > 0);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.expenditure),
          backgroundColor: rows.map((_, i) => colorFor(i)),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [yearRows]);

  const companyBarData = useMemo(
    () => ({
      labels: companyRows.map((r) => r.name),
      datasets: [
        { label: "Received", data: companyRows.map((r) => r.received), backgroundColor: CHART_COLORS.received, borderRadius: 8, maxBarThickness: 38 },
        { label: "Expenditure", data: companyRows.map((r) => r.expenditure), backgroundColor: CHART_COLORS.expenditure, borderRadius: 8, maxBarThickness: 38 },
      ],
    }),
    [companyRows],
  );

  const companyPie = useMemo(() => {
    const rows = companyRows.filter((r) => r.expenditure > 0);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.expenditure),
          backgroundColor: rows.map((_, i) => colorFor(i)),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [companyRows]);

  const projectBarRows = useMemo(
    () => [...projectRows].sort((a, b) => b.budget - a.budget).slice(0, 10),
    [projectRows],
  );
  const projectBarData = useMemo(
    () => ({
      labels: projectBarRows.map((r) => r.name),
      datasets: [
        { label: "Budget", data: projectBarRows.map((r) => r.budget), backgroundColor: CHART_COLORS.budget, borderRadius: 8, maxBarThickness: 30 },
        { label: "Spent", data: projectBarRows.map((r) => r.spent), backgroundColor: CHART_COLORS.spent, borderRadius: 8, maxBarThickness: 30 },
      ],
    }),
    [projectBarRows],
  );

  const statusPie = useMemo(() => {
    const counts: Record<string, number> = {};
    projectRows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    const keys = Object.keys(counts);
    return {
      labels: keys.map((k) => STATUS_LABELS[k] ?? k),
      datasets: [
        {
          data: keys.map((k) => counts[k]),
          backgroundColor: keys.map((k) => STATUS_COLORS[k] ?? "#64748B"),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [projectRows]);

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
    } else if (tab === "project") {
      downloadCsv(
        "project-wise-report",
        [
          "Project",
          "Company",
          "Period",
          "Budget",
          "Committed",
          "Received",
          "Spent",
          "Utilization %",
          "Status",
        ],
        projectRows.map((r) => [
          r.name,
          r.company,
          r.period,
          r.budget,
          r.committed,
          r.received,
          r.spent,
          r.utilization,
          r.status,
        ]),
      );
    } else if (tab === "carryForward") {
      downloadCsv(
        "carry-forward-report",
        ["Project", "Company", "Contribution %", "Carry Forward Share", "Rolls Into"],
        carryForwardRows.map((r) => [r.project, r.company, r.pct ?? "—", r.share, r.rollsInto]),
      );
    } else {
      downloadCsv(
        "transaction-ledger",
        ["Type", "Date", "Company", "Project", "FY", "Base Amount", "Carry Forward", "Total Balance"],
        ledgerRows.map((r) => [
          r.type === "receipt" ? "Receipt" : "Expenditure",
          r.date,
          r.company,
          r.project,
          r.fy,
          r.baseAmount,
          r.carryForward,
          r.runningBalance,
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
        {tabBtn("ledger", "Transaction Ledger")}
        {tabBtn("year", "Year-wise Summary")}
        {tabBtn("company", "Company-wise Summary")}
        {tabBtn("project", "Project-wise Summary")}
        {tabBtn("carryForward", "Carry Forward")}
      </div>

      <div id="report-printable">
        {tab === "year" && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCard title="Fund Flow by Financial Year">
                  <Bar
                    data={{
                      labels: yearRows.map((r) => r.name),
                      datasets: [
                        { label: "Received", data: yearRows.map((r) => r.fundsReceived), backgroundColor: CHART_COLORS.received, borderRadius: 8, maxBarThickness: 38 },
                        { label: "Carry In", data: yearRows.map((r) => r.carryForwardIn), backgroundColor: CHART_COLORS.carryForwardIn, borderRadius: 8, maxBarThickness: 38 },
                        { label: "Expenditure", data: yearRows.map((r) => r.expenditure), backgroundColor: CHART_COLORS.expenditure, borderRadius: 8, maxBarThickness: 38 },
                      ],
                    }}
                    options={moneyBarOptions()}
                  />
                </ChartCard>
              </div>
              <ChartCard title="Expenditure Share by Year">
                {yearPie.labels.length > 0 ? (
                  <Pie data={yearPie} options={pieOptions()} />
                ) : (
                  <EmptyChartNote />
                )}
              </ChartCard>
            </div>

            <Card className="p-2 sm:p-4">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                Total Received: <span className="font-semibold text-ink">{formatINR(yearTotals.fundsReceived)}</span> · Expenditure: <span className="font-semibold text-danger">{formatINR(yearTotals.expenditure)}</span> · Balance: <span className="font-semibold text-success">{formatINR(yearTotals.balance)}</span>
              </div>
              <DataTable
                data={yearRows}
                columns={[
                  { data: "name", title: "Financial Year" },
                  { data: "fundsReceived", title: "Funds Received", className: "text-right", render: money },
                  { data: "carryForwardIn", title: "Carry Forward In", className: "text-right", render: money },
                  { data: "totalAvailable", title: "Total Available", className: "text-right", render: money },
                  { data: "expenditure", title: "Expenditure", className: "text-right", render: money },
                  { data: "balance", title: "Balance", className: "text-right", render: money },
                  { data: "carryForwardOut", title: "Carry Forward Out", className: "text-right", render: money },
                ]}
                slots={{
                  4: (_v, row) => <span className="text-danger">{formatINR(row.expenditure)}</span>,
                  5: (_v, row) => <span className="text-success">{formatINR(row.balance)}</span>,
                }}
                options={{ searching: false, order: [] }}
              />
            </Card>
          </>
        )}

        {tab === "company" && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCard title="Received vs Expenditure by Company">
                  {companyRows.length > 0 ? (
                    <Bar data={companyBarData} options={moneyBarOptions()} />
                  ) : (
                    <EmptyChartNote />
                  )}
                </ChartCard>
              </div>
              <ChartCard title="Expenditure Share by Company">
                {companyPie.labels.length > 0 ? (
                  <Pie data={companyPie} options={pieOptions()} />
                ) : (
                  <EmptyChartNote />
                )}
              </ChartCard>
            </div>

            <Card className="p-2 sm:p-4">
            <DataTable
              data={companyRows}
              columns={[
                { data: "name", title: "Company" },
                { data: "received", title: "Total Received", className: "text-right", render: money },
                { data: "carry", title: "Carry Forward", className: "text-right", render: money },
                { data: "expenditure", title: "Expenditure", className: "text-right", render: money },
                { data: "balance", title: "Balance", className: "text-right", render: money },
                { data: "projects", title: "Projects", className: "text-right" },
              ]}
              slots={{
                3: (_v, row) => <span className="text-danger">{formatINR(row.expenditure)}</span>,
                4: (_v, row) => <span className="text-success">{formatINR(row.balance)}</span>,
              }}
              options={{ searching: false, order: [] }}
            />
          </Card>
          </>
        )}

        {tab === "project" && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCard title="Budget vs Spent by Project">
                  {projectBarRows.length > 0 ? (
                    <Bar data={projectBarData} options={moneyBarOptions({ rotateLabels: projectBarRows.length > 4 })} />
                  ) : (
                    <EmptyChartNote />
                  )}
                </ChartCard>
                {projectRows.length > projectBarRows.length && (
                  <p className="mt-2 text-xs text-muted">
                    Showing top {projectBarRows.length} of {projectRows.length} projects by budget.
                  </p>
                )}
              </div>
              <ChartCard title="Projects by Status">
                {statusPie.labels.length > 0 ? (
                  <Pie data={statusPie} options={pieOptions((v) => `${v} project${v === 1 ? "" : "s"}`)} />
                ) : (
                  <EmptyChartNote />
                )}
              </ChartCard>
            </div>

            <Card className="p-2 sm:p-4">
            <DataTable
              data={projectRows}
              columns={[
                { data: "name", title: "Project" },
                { data: "company", title: "Company" },
                { data: "period", title: "Period" },
                { data: "budget", title: "Budget", className: "text-right", render: money },
                { data: "committed", title: "Committed", className: "text-right", render: money },
                { data: "received", title: "Received", className: "text-right", render: money },
                { data: "spent", title: "Spent", className: "text-right", render: money },
                { data: "utilization", title: "Utilization", className: "text-right", render: (d, type) => (type === "display" ? d + "%" : d) },
                { data: "status", title: "Status" },
              ]}
              slots={{
                5: (_v, row) => <span className="text-success">{formatINR(row.received)}</span>,
                6: (_v, row) => <span className="text-danger">{formatINR(row.spent)}</span>,
                8: (_v, row) => <StatusBadge status={row.status} />,
              }}
              options={{ searching: false, order: [] }}
            />
          </Card>
          </>
        )}

        {tab === "carryForward" && (
          <>
            <p className="mb-5 rounded-xl bg-ink/[0.03] px-4 py-3 text-sm text-muted">
              Unused budget carried forward by each Ongoing project, split across its contributing
              companies in proportion to what each one put in.
            </p>
            <Card className="p-2 sm:p-4">
              {carryForwardRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No carry-forward amounts recorded yet.</p>
              ) : (
                <DataTable
                  data={carryForwardRows}
                  columns={[
                    { data: "project", title: "Project" },
                    { data: "company", title: "Company" },
                    { data: "pct", title: "Contribution %", className: "text-right", render: (d, type) => (type === "display" ? (d === null ? "—" : `${d}%`) : d) },
                    { data: "share", title: "Carry Forward Share", className: "text-right", render: money },
                    { data: "rollsInto", title: "Rolls Into" },
                  ]}
                  slots={{
                    3: (_v, row) => <span className="font-semibold text-success">{formatINR(row.share)}</span>,
                  }}
                  options={{ searching: false, order: [] }}
                />
              )}
            </Card>
          </>
        )}

        {tab === "ledger" && (
          <>
            <div className="mb-6">
              <ChartCard title="Ledger Overview">
                {yearRows.length > 0 ? (
                  <Bar
                    data={{
                      labels: yearRows.map((r) => r.name),
                      datasets: [
                        { label: "Receipts", data: yearRows.map((r) => r.fundsReceived), backgroundColor: CHART_COLORS.received, borderRadius: 8, maxBarThickness: 38 },
                        { label: "Expenditure", data: yearRows.map((r) => r.expenditure), backgroundColor: CHART_COLORS.expenditure, borderRadius: 8, maxBarThickness: 38 },
                      ],
                    }}
                    options={moneyBarOptions()}
                  />
                ) : (
                  <EmptyChartNote />
                )}
              </ChartCard>
            </div>

            <Card className="p-2 sm:p-4">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                Total Receipts: <span className="font-semibold text-success">{formatINR(ledgerTotals.totalReceipts)}</span> · Total Expenditures: <span className="font-semibold text-danger">{formatINR(ledgerTotals.totalExpenditures)}</span> · Net Balance: <span className="font-semibold text-ink">{formatINR(ledgerTotals.netBalance)}</span>
              </div>
              <DataTable
                data={ledgerRows}
                columns={[
                  { data: "type", title: "Type" },
                  { data: "date", title: "Date", render: dateCell },
                  { data: "company", title: "Company" },
                  { data: "project", title: "Project" },
                  { data: "fy", title: "FY" },
                  { data: "baseAmount", title: "Base Amount", className: "text-right", render: money },
                  { data: "carryForward", title: "Carry Forward", className: "text-right", render: money },
                  { data: "runningBalance", title: "Total Balance", className: "text-right", render: money },
                ]}
                slots={{
                  0: (_v, row) =>
                    row.type === "receipt" ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Receipt</span>
                    ) : (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Expenditure</span>
                    ),
                  5: (_v, row) => (
                    <span className={row.type === "receipt" ? "text-success" : "text-danger"}>{formatINR(row.baseAmount)}</span>
                  ),
                  7: (_v, row) => <span className="font-semibold text-ink">{formatINR(row.runningBalance)}</span>,
                }}
                options={{ searching: true, order: [] }}
              />
            </Card>
          </>
        )}
      </div>
    </>
  );
}
