import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as CJLegend,
  LinearScale,
  Tooltip as CJTooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
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
import { Card, PageHeader, Select, StatusBadge } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { downloadCsv, printReport, saveBlob } from "../lib/exporters";
import { useAuth } from "../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, CJTooltip, CJLegend);

type Tab = "year" | "company" | "project";
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const money = (d: unknown, type: string) =>
  type === "display" ? formatINR(Number(d)) : Number(d);

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
              <div className="h-[320px]">
                <Bar
                  data={{
                    labels: yearRows.map((r) => r.name),
                    datasets: [
                      { label: "Received", data: yearRows.map((r) => r.fundsReceived), backgroundColor: "#2563EB", borderRadius: 8, maxBarThickness: 38 },
                      { label: "Carry In", data: yearRows.map((r) => r.carryForwardIn), backgroundColor: "#60A5FA", borderRadius: 8, maxBarThickness: 38 },
                      { label: "Expenditure", data: yearRows.map((r) => r.expenditure), backgroundColor: "#F59E0B", borderRadius: 8, maxBarThickness: 38 },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", color: "#94a3b8", boxWidth: 8, font: { size: 13 } } },
                      tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${formatINR(c.parsed.y)}` }, padding: 10, cornerRadius: 10 },
                    },
                    scales: {
                      x: { grid: { display: false }, border: { color: "rgba(148,163,184,0.22)" }, ticks: { color: "#94a3b8" } },
                      y: { grid: { color: "rgba(148,163,184,0.18)" }, border: { display: false }, ticks: { color: "#94a3b8", callback: (v: any) => formatLakhAxis(Number(v)) } },
                    },
                  } as any}
                />
              </div>
            </Card>

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
        )}

        {tab === "project" && (
          <Card className="p-2 sm:p-4">
            <DataTable
              data={projectRows}
              columns={[
                { data: "name", title: "Project" },
                { data: "company", title: "Company" },
                { data: "year", title: "Year" },
                { data: "budget", title: "Budget", className: "text-right", render: money },
                { data: "spent", title: "Spent", className: "text-right", render: money },
                { data: "utilization", title: "Utilization", className: "text-right", render: (d, type) => (type === "display" ? d + "%" : d) },
                { data: "status", title: "Status" },
              ]}
              slots={{
                4: (_v, row) => <span className="text-danger">{formatINR(row.spent)}</span>,
                6: (_v, row) => <StatusBadge status={row.status} />,
              }}
              options={{ searching: false, order: [] }}
            />
          </Card>
        )}
      </div>
    </>
  );
}
