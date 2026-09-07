import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatCard, SectionCard, StatusPill, EmptyState, TableSkeleton } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated } from "@/lib/store";
import { dateLabel, isOverdue, isToday, money, pct, quotationTotals } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LEPDO Sales CRM" },
      {
        name: "description",
        content: "Daily sales snapshot: tasks, follow-ups, leads, quotations and monthly goal progress.",
      },
      { property: "og:title", content: "Dashboard — LEPDO Sales CRM" },
      {
        property: "og:description",
        content: "Daily sales snapshot for the LEPDO team.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";
  const [sellerFilter, setSellerFilter] = useState("all");

  const owner = admin ? sellerFilter : user.id;
  const mine = <T extends { assignedTo: string }>(rows: T[]) =>
    owner === "all" ? rows : rows.filter((r) => r.assignedTo === owner);

  const tasks = mine(state.tasks);
  const followUps = mine(state.followUps);
  const leads = mine(state.leads);
  const quotations = mine(state.quotations);
  const data = mine(state.data);

  const wonValue = leads.filter((l) => l.stage === "Won").reduce((a, l) => a + l.value, 0);
  const goal =
    owner === "all"
      ? state.users.filter((u) => u.active).reduce((a, u) => a + u.monthlyGoal, 0)
      : (state.users.find((u) => u.id === owner)?.monthlyGoal ?? 0);

  const openTasks = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
  const todayTasks = openTasks.filter((t) => isToday(t.dueDate));
  const overdueTasks = openTasks.filter((t) => isOverdue(t.dueDate));
  const upcomingTasks = openTasks
    .filter((t) => !isToday(t.dueDate) && !isOverdue(t.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const primary = [
    {
      label: "Today's Follow-Ups",
      value: followUps.filter((f) => isToday(f.nextDate) && !f.completed).length,
      tone: "mint" as const,
      to: "/follow-up" as const,
      search: { quick: "today" },
    },
    {
      label: "Overdue Follow-Ups",
      value: followUps.filter((f) => isOverdue(f.nextDate) && !f.completed).length,
      tone: "rose" as const,
      to: "/follow-up" as const,
      search: { quick: "overdue" },
    },
    {
      label: "Today's Tasks",
      value: todayTasks.length,
      tone: "blue" as const,
      to: "/tasks" as const,
      search: { view: "today" },
    },
    {
      label: "New Leads",
      value: leads.filter((l) => l.stage === "New").length,
      tone: "peach" as const,
      to: "/leads" as const,
      search: { stage: "New" },
    },
    {
      label: "Quotations Sent",
      value: quotations.filter((q) => q.status === "Sent" || q.status === "Viewed").length,
      tone: "lavender" as const,
      to: "/quotations" as const,
      search: { status: "Sent" },
    },
    {
      label: "Won Opportunity Value",
      value: money(wonValue),
      tone: "yellow" as const,
      hint: "Value of leads marked Won",
      to: "/leads" as const,
      search: { stage: "Won" },
    },
  ];

  const secondary = [
    { label: "Pending Tasks", value: openTasks.length, tone: "lavender" as const },
    { label: "Overdue Tasks", value: overdueTasks.length, tone: "rose" as const },
    {
      label: "Hot Leads",
      value: leads.filter((l) => l.priority === "Urgent" || l.priority === "High").length,
      tone: "peach" as const,
    },
    { label: "Draft Quotations", value: quotations.filter((q) => q.status === "Draft").length, tone: "blue" as const },
    { label: "Monthly Goal", value: money(goal), tone: "mint" as const },
    { label: "Goal Achieved", value: `${pct(wonValue, goal)}%`, tone: "yellow" as const },
    { label: "Prospect Records", value: data.length, tone: "blue" as const },
    {
      label: "Follow-Ups Completed",
      value: followUps.filter((f) => f.completed).length,
      tone: "mint" as const,
    },
  ];

  const trend = useMemo(() => {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return months.map((m, i) => ({
      month: m,
      sales: Math.round((wonValue || 25000) * (0.5 + i * 0.12)),
    }));
  }, [wonValue]);

  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => map.set(d.country, (map.get(d.country) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [data]);

  const stageCounts = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => map.set(l.stage, (map.get(l.stage) ?? 0) + 1));
    return [...map.entries()];
  }, [leads]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {admin && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="seller">
            View data for
          </label>
          <select
            id="seller"
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="all">All users (team)</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {primary.map((c) => (
          <Link key={c.label} to={c.to} search={c.search} className="min-w-0">
            <StatCard label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
          </Link>
        ))}
      </div>

      <details className="card-soft px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">More figures</summary>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {secondary.map((c) => (
            <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} />
          ))}
        </div>
      </details>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Goal vs Achievement" className="lg:col-span-1">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{money(wonValue)}</span>
              <span className="text-muted-foreground">of {money(goal)}</span>
            </div>
            <Progress value={Math.min(100, pct(wonValue, goal))} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {pct(wonValue, goal)}% of the monthly goal achieved.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Monthly Sales Trend" className="lg:col-span-2">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="sales" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard
          title="Today's Priority Tasks"
          action={
            <Link to="/tasks" search={{ view: "today" }} className="text-xs font-medium text-primary">
              View all
            </Link>
          }
        >
          <div className="space-y-3">
            <TaskGroup title="Due today" tasks={todayTasks} />
            <TaskGroup title="Overdue" tasks={overdueTasks} overdue />
            <TaskGroup title="Upcoming" tasks={upcomingTasks} />
            {openTasks.length === 0 && (
              <EmptyState title="No open tasks" description="Everything is done for now." />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Upcoming & Overdue Follow-Ups"
          action={
            <Link to="/follow-up" className="text-xs font-medium text-primary">
              View all
            </Link>
          }
        >
          <ul className="space-y-2">
            {followUps
              .filter((f) => !f.completed)
              .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
              .slice(0, 5)
              .map((f) => (
                <li key={f.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.company}</span>
                  <StatusPill value={f.status} />
                  <span
                    className={`shrink-0 text-xs ${isOverdue(f.nextDate) ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {dateLabel(f.nextDate)}
                  </span>
                </li>
              ))}
            {followUps.filter((f) => !f.completed).length === 0 && (
              <EmptyState title="No follow-ups scheduled" />
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Recent Leads">
          <ul className="space-y-2">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {l.company} <span className="text-muted-foreground">· {l.country}</span>
                </span>
                <StatusPill value={l.stage} />
                <span className="shrink-0 text-xs text-muted-foreground">{money(l.value)}</span>
              </li>
            ))}
            {leads.length === 0 && <EmptyState title="No leads yet" />}
          </ul>
        </SectionCard>

        <SectionCard title="Lead Status Summary">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stageCounts.map(([stage, count]) => (
              <div key={stage} className="rounded-lg bg-muted/60 p-2">
                <div className="truncate text-[11px] text-muted-foreground">{stage}</div>
                <div className="text-lg font-semibold">{count}</div>
              </div>
            ))}
            {stageCounts.length === 0 && <EmptyState title="No pipeline data" />}
          </div>
        </SectionCard>

        <SectionCard title="Country-wise Prospects">
          <ul className="space-y-1.5 text-sm">
            {byCountry.map(([country, count]) => (
              <li key={country} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{country}</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct(count, data.length || 1)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
              </li>
            ))}
            {byCountry.length === 0 && <EmptyState title="No prospect data" />}
          </ul>
        </SectionCard>

        <SectionCard title="Sales Pipeline Summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open pipeline value</span>
              <span className="font-medium">
                {money(
                  leads
                    .filter((l) => l.stage !== "Won" && l.stage !== "Lost")
                    .reduce((a, l) => a + l.value, 0),
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Won value</span>
              <span className="font-medium">{money(wonValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quotation value</span>
              <span className="font-medium">
                {money(quotations.reduce((a, q) => a + quotationTotals(q).total, 0))}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Recent Activity">
        <ul className="space-y-2 text-sm">
          {state.activity.slice(0, 6).map((a) => (
            <li key={a.id} className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{a.at}</span>
              <span className="min-w-0 flex-1 truncate">
                {a.action} · {a.record}
              </span>
              <span className="text-xs text-muted-foreground">
                {state.users.find((u) => u.id === a.userId)?.name}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/data">Add prospect data</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/follow-up">Today's follow-ups</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/quotations">Create quotation</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/leads">Add lead</Link>
        </Button>
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  overdue,
}: {
  title: string;
  tasks: { id: string; title: string; priority: string; dueDate: string }[];
  overdue?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">
        {title} ({tasks.length})
      </p>
      <ul className="space-y-1.5">
        {tasks.slice(0, 5).map((t) => (
          <li key={t.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <StatusPill value={t.priority} />
            <span className="min-w-0 flex-1 break-words">{t.title}</span>
            <span className={`shrink-0 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
              {dateLabel(t.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
