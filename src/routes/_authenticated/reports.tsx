import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatCard, SectionCard, EmptyState, TableSkeleton } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated } from "@/lib/store";
import { money, pct, isOverdue, quotationTotals } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/io";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Report & Analysis — LEPDO Sales CRM" },
      { name: "description", content: "Sales, data, lead and follow-up performance reports with filters and opportunity insights." },
      { property: "og:title", content: "Report & Analysis — LEPDO Sales CRM" },
      { property: "og:description", content: "Track sales, conversion rates and opportunities across the LEPDO team." },
    ],
  }),
  component: ReportsPage,
});

const CHART_COLORS = ["#9ec5f2", "#c4b5f0", "#9ee0c4", "#f5c1a0", "#f2dc9e", "#f2a8bb"];

function ReportsPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";

  const [seller, setSeller] = useState("");
  const [country, setCountry] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const inRange = (date?: string | null) => {
    if (!date) return !from && !to;
    const d = date.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  const mine = (assignedTo: string) => (admin ? !seller || assignedTo === seller : assignedTo === user.id);

  const data = useMemo(
    () => state.data.filter((r) => !r.archived && mine(r.assignedTo) && inRange(r.createdAt)
      && (!country || r.country === country) && (!source || r.source === source)),
    [state.data, seller, country, source, from, to, admin, user.id],
  );
  const leads = useMemo(
    () => state.leads.filter((l) => !l.archived && mine(l.assignedTo) && inRange(l.createdAt)
      && (!country || l.country === country) && (!source || l.source === source)),
    [state.leads, seller, country, source, from, to, admin, user.id],
  );
  const followUps = useMemo(
    () => state.followUps.filter((f) => !f.archived && mine(f.assignedTo) && (!country || f.country === country)),
    [state.followUps, seller, country, admin, user.id],
  );
  const quotations = useMemo(
    () => state.quotations.filter((q) => !q.archived && mine(q.assignedTo) && inRange(q.date) && (!country || q.country === country)),
    [state.quotations, seller, country, from, to, admin, user.id],
  );

  const won = leads.filter((l) => l.stage === "Won");
  const lost = leads.filter((l) => l.stage === "Lost");

  /**
   * Three different money figures that must never be mixed:
   *  - Won opportunity value: pipeline value of leads marked Won (lead date).
   *  - Issued invoice sales: invoices raised from accepted quotations (invoice date).
   *  - Payments received: the amount actually collected against those invoices.
   */
  const wonValue = won.reduce((a, l) => a + l.value, 0);
  const invoiced = quotations.filter(
    (q) => q.invoice && q.invoice.status !== "Cancelled" && inRange(q.invoice.date),
  );
  const invoiceSales = invoiced.reduce((a, q) => a + quotationTotals(q).total, 0);
  const paymentsReceived = invoiced.reduce((a, q) => a + (q.invoice?.amountPaid ?? 0), 0);
  const invoiceCurrencies = [...new Set(invoiced.map((q) => q.currency))];
  const mixedCurrency = invoiceCurrencies.length > 1;
  const invoiceCurrency = invoiceCurrencies[0] ?? "USD";
  const totalSales = wonValue;
  const goal = admin
    ? state.users.filter((u) => u.active).reduce((a, u) => a + u.monthlyGoal, 0)
    : user.monthlyGoal;

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      map.set(d.toLocaleString("en", { month: "short" }), 0);
    }
    won.forEach((l) => {
      const key = new Date(l.createdAt).toLocaleString("en", { month: "short" });
      if (map.has(key)) map.set(key, map.get(key)! + l.value);
    });
    return Array.from(map, ([month, value]) => ({ month, value }));
  }, [won]);

  const groupBy = <T,>(rows: T[], key: (r: T) => string, value: (r: T) => number = () => 1) => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const k = key(r) || "Unknown";
      map.set(k, (map.get(k) ?? 0) + value(r));
    });
    return Array.from(map, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  };

  const bySeller = groupBy(won, (l) => state.users.find((u) => u.id === l.assignedTo)?.name ?? "—", (l) => l.value);
  const byCountry = groupBy(won, (l) => l.country, (l) => l.value);
  const bySourceData = groupBy(data, (r) => r.source);
  const byProduct = groupBy(leads, (l) => l.requirement.productType, (l) => l.value);

  const contacted = data.filter((r) => r.status !== "New").length;
  const converted = data.filter((r) => r.status === "Converted to Lead").length;
  const invalid = data.filter((r) => r.status === "Invalid").length;
  const fuCompleted = followUps.filter((f) => f.completed).length;
  const fuOverdue = followUps.filter((f) => !f.completed && isOverdue(f.nextDate)).length;

  const lossReasons = groupBy(lost.filter((l) => l.lossReason), (l) => l.lossReason!);
  const bestCountry = groupBy(leads.filter((l) => ["Qualified", "Won"].includes(l.stage)), (l) => l.country)[0];
  const bestSource = bySourceData[0];
  const topSeller = bySeller[0];
  const urgent = followUps.filter((f) => !f.completed && isOverdue(f.nextDate)).slice(0, 5);
  const todayStr = new Date().toISOString().slice(0, 10);
  const in10Days = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const expiring = quotations
    .filter((q) => ["Sent", "Viewed"].includes(q.status) && q.validUntil >= todayStr && q.validUntil <= in10Days)
    .sort((a, b) => a.validUntil.localeCompare(b.validUntil))
    .slice(0, 5);
  const expired = quotations.filter(
    (q) => ["Sent", "Viewed"].includes(q.status) && q.validUntil < todayStr,
  );
  const highValue = [...leads].filter((l) => !["Won", "Lost"].includes(l.stage)).sort((a, b) => b.value - a.value).slice(0, 5);

  const sellerLabel = (id: string) => state.users.find((u) => u.id === id)?.name ?? "";
  const exportRows = () => [
    ...won.map((l) => ({
      Metric: "Won opportunity", Reference: l.id, Date: l.createdAt.slice(0, 10),
      Company: l.company, Country: l.country, Source: l.source,
      Currency: "USD", Amount: l.value, Seller: sellerLabel(l.assignedTo),
    })),
    ...invoiced.map((q) => ({
      Metric: "Issued invoice", Reference: q.invoice?.number ?? q.number, Date: q.invoice?.date ?? q.date,
      Company: q.company, Country: q.country, Source: "",
      Currency: q.currency, Amount: quotationTotals(q).total, Seller: sellerLabel(q.assignedTo),
    })),
    ...invoiced
      .filter((q) => (q.invoice?.amountPaid ?? 0) > 0)
      .map((q) => ({
        Metric: "Payment received", Reference: q.invoice?.number ?? q.number, Date: q.invoice?.date ?? q.date,
        Company: q.company, Country: q.country, Source: "",
        Currency: q.currency, Amount: q.invoice?.amountPaid ?? 0, Seller: sellerLabel(q.assignedTo),
      })),
  ];

  if (!hydrated) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        {admin && (
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Seller</span>
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={seller} onChange={(e) => setSeller(e.target.value)}>
              <option value="">All sellers</option>
              {state.users.filter((u) => u.role === "seller").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Country</span>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries</option>
            {state.settings.countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Source</span>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {state.settings.sources.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">From</span>
          <input type="date" className="h-9 rounded-lg border bg-background px-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">To</span>
          <input type="date" className="h-9 rounded-lg border bg-background px-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button size="sm" variant="ghost" onClick={() => { setSeller(""); setCountry(""); setSource(""); setFrom(""); setTo(""); }}>Clear filters</Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv(exportRows(), "lepdo-sales-report")}>Export CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportExcel(exportRows(), "lepdo-sales-report")}>Export Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>Export PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Won Opportunity Value"
          value={money(wonValue)}
          hint={`${won.length} won lead(s), by lead date`}
          tone="mint"
        />
        <StatCard
          label="Issued Invoice Sales"
          value={mixedCurrency ? "Mixed currencies" : money(invoiceSales, invoiceCurrency)}
          hint={
            mixedCurrency
              ? `${invoiced.length} invoice(s) in ${invoiceCurrencies.join(", ")} — not added up`
              : `${invoiced.length} invoice(s), by invoice date`
          }
          tone="blue"
        />
        <StatCard
          label="Payments Received"
          value={mixedCurrency ? "Mixed currencies" : money(paymentsReceived, invoiceCurrency)}
          hint={mixedCurrency ? "Convert first to compare" : `${money(Math.max(0, invoiceSales - paymentsReceived), invoiceCurrency)} outstanding`}
          tone="lavender"
        />
        <StatCard
          label="Goal vs Won Value"
          value={`${pct(wonValue, goal)}%`}
          hint={`${money(wonValue)} of ${money(goal)}`}
          tone="peach"
        />
        <StatCard
          label="Won vs Lost Value"
          value={`${money(wonValue)} / ${money(lost.reduce((a, l) => a + l.value, 0))}`}
          hint={`${won.length} won · ${lost.length} lost`}
          tone="yellow"
        />
        <StatCard
          label="Lead Conversion"
          value={`${pct(won.length, leads.length)}%`}
          hint={`${won.length} won of ${leads.length} leads`}
          tone="rose"
        />
      </div>
      {mixedCurrency && (
        <p className="rounded-lg bg-pastel-yellow px-3 py-2 text-xs">
          Invoices in this range use more than one currency ({invoiceCurrencies.join(", ")}). Amounts
          are shown per currency only — no exchange rate is applied.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Monthly won opportunity value">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="value" stroke="#7aa7dd" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Won value by country">
          <div className="h-56">
            {byCountry.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCountry.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {byCountry.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No sales in this range" />}
          </div>
        </SectionCard>

        <SectionCard title="Won value by seller">
          {bySeller.length ? (
            <table className="w-full text-sm">
              <tbody>
                {bySeller.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-1.5">{r.name}</td>
                    <td className="py-1.5 text-right font-medium">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="No seller sales yet" />}
        </SectionCard>

        <SectionCard title="Data source performance">
          <div className="h-56">
            {bySourceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySourceData} dataKey="total" nameKey="name" innerRadius={40} outerRadius={75}>
                    {bySourceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No data records" />}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Data performance">
          <ul className="space-y-1.5 text-sm">
            <Row label="Total data added" value={data.length} />
            <Row label="Valid vs invalid" value={`${data.length - invalid} / ${invalid}`} />
            <Row label="Contact rate" value={`${pct(contacted, data.length)}% (${contacted} of ${data.length})`} />
            <Row label="Data to lead conversion" value={`${pct(converted, data.length)}% (${converted} of ${data.length})`} />
            <Row label="Countries covered" value={new Set(data.map((r) => r.country)).size} />
          </ul>
        </SectionCard>

        <SectionCard title="Leads & follow-ups">
          <ul className="space-y-1.5 text-sm">
            <Row label="New leads" value={leads.filter((l) => l.stage === "New").length} />
            <Row label="Qualified leads" value={leads.filter((l) => l.stage === "Qualified").length} />
            <Row label="Won / Lost" value={`${won.length} / ${lost.length}`} />
            <Row label="Follow-up completion" value={`${pct(fuCompleted, followUps.length)}% (${fuCompleted} of ${followUps.length})`} />
            <Row label="Overdue follow-ups" value={fuOverdue} />
          </ul>
        </SectionCard>

        <SectionCard title="Most common loss reasons">
          {lossReasons.length ? (
            <ul className="space-y-1.5 text-sm">
              {lossReasons.map((r) => <Row key={r.name} label={r.name} value={r.total} />)}
            </ul>
          ) : <EmptyState title="No lost leads" description="Nothing lost in this range — good news." />}
        </SectionCard>
      </div>

      <SectionCard title="Opportunity insights">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Insight title="Best country by qualified & won leads" body={bestCountry ? `${bestCountry.name} — ${bestCountry.total} qualified/won leads` : "Not enough data"} tone="bg-pastel-mint/60" />
          <Insight title="Best data source by record volume" body={bestSource ? `${bestSource.name} — ${bestSource.total} records added` : "Not enough data"} tone="bg-pastel-blue/60" />
          <Insight title="Top seller by won opportunity value" body={topSeller ? `${topSeller.name} — ${money(topSeller.total)}` : "Not enough data"} tone="bg-pastel-lavender/60" />
          <Insight title="Leads needing urgent follow-up" body={urgent.length ? urgent.map((f) => f.company).join(", ") : "All follow-ups are on time"} tone="bg-pastel-peach/60" />
          <Insight
            title="Quotations close to expiry"
            body={
              expiring.length
                ? `${expiring.map((q) => `${q.number} valid to ${q.validUntil}`).join(", ")}${expired.length ? ` · ${expired.length} already expired` : ""}`
                : expired.length
                  ? `No quotation expires in the next 10 days · ${expired.length} already expired`
                  : "No quotations expiring soon"
            }
            tone="bg-pastel-yellow/60"
          />
          <Insight title="High value open opportunities" body={highValue.length ? highValue.map((l) => `${l.company} ${money(l.value)}`).join(", ") : "No open leads"} tone="bg-pastel-rose/60" />
        </div>
      </SectionCard>

      <SectionCard title="Product-wise value">
        {byProduct.length ? (
          <div>
            <table className="w-full table-fixed text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Product</th><th className="py-1 text-right">Pipeline value</th></tr></thead>
              <tbody>
                {byProduct.map((r) => (
                  <tr key={r.name} className="border-t"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right">{money(r.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No leads in this range" />}
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-0">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </li>
  );
}

function Insight({ title, body, tone }: { title: string; body: string; tone: string }) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <div className="text-xs font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
