import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Target as TargetIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, StatCard, TableSkeleton } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, isAdmin, uid, logActivity } from "@/lib/store";
import { amount, dateLabel, todayIso } from "@/lib/format";
import type { Target, TargetPeriod } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/targets")({
  head: () => ({
    meta: [
      { title: "Targets · LEPDO Sales CRM" },
      {
        name: "description",
        content:
          "Monthly, quarterly and yearly LEPDO sales targets measured against confirmed orders only.",
      },
      { property: "og:title", content: "Targets · LEPDO Sales CRM" },
      {
        property: "og:description",
        content: "Track target amount, achieved value, remaining gap and days left.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TargetsPage,
});

const PERIODS: TargetPeriod[] = ["Monthly", "Quarterly", "Yearly", "Custom"];

function periodRange(period: TargetPeriod, from: string) {
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(d);
  if (period === "Monthly") end.setMonth(d.getMonth() + 1);
  else if (period === "Quarterly") end.setMonth(d.getMonth() + 3);
  else if (period === "Yearly") end.setFullYear(d.getFullYear() + 1);
  else return "";
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}

function TargetsPage() {
  const ready = useHydrated();
  const me = useCurrentUser();
  const state = useCrm((s) => s);
  const admin = isAdmin(me.id, state);
  const targets = useMemo(
    () =>
      state.targets
        .filter((t) => !t.archived)
        .filter((t) => admin || t.companyWide || t.assignedTo === me.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [state.targets, admin, me.id],
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Target, "id">>({
    name: "",
    period: "Monthly",
    startDate: todayIso().slice(0, 8) + "01",
    endDate: periodRange("Monthly", todayIso().slice(0, 8) + "01"),
    currency: state.settings.currencies[0] ?? "USD",
    amount: 0,
    assignedTo: null,
    companyWide: true,
  });

  /** Achievement counts confirmed orders only, and never mixes currencies. */
  function achievement(t: Target) {
    const rows = state.orders.filter(
      (o) =>
        !o.archived &&
        o.orderStatus !== "Cancelled" &&
        o.currency === t.currency &&
        o.orderDate >= t.startDate &&
        o.orderDate <= t.endDate &&
        (t.companyWide || o.assignedTo === t.assignedTo),
    );
    const achieved = rows.reduce((sum, o) => sum + o.amount, 0);
    const days = Math.max(
      0,
      Math.ceil((new Date(`${t.endDate}T00:00:00`).getTime() - Date.now()) / 86_400_000),
    );
    return {
      achieved,
      orders: rows.length,
      avg: rows.length ? achieved / rows.length : 0,
      remaining: Math.max(0, t.amount - achieved),
      percent: t.amount > 0 ? Math.min(100, (achieved / t.amount) * 100) : 0,
      days,
    };
  }

  const totals = useMemo(() => {
    const current = targets.filter((t) => t.startDate <= todayIso() && t.endDate >= todayIso());
    const sum = current.reduce(
      (acc, t) => {
        const a = achievement(t);
        return { target: acc.target + t.amount, achieved: acc.achieved + a.achieved };
      },
      { target: 0, achieved: 0 },
    );
    return { count: current.length, ...sum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, state.orders]);

  function save() {
    if (!form.name.trim()) {
      toast.error("Give the target a name");
      return;
    }
    if (!(form.amount > 0)) {
      toast.error("Target amount must be greater than zero");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("End date must be after the start date");
      return;
    }
    const row: Target = { ...form, id: uid() };
    setState((s) => ({ ...s, targets: [row, ...s.targets] }));
    logActivity({ action: "Target created", module: "Targets", record: row.name });
    setOpen(false);
    toast.success("Target created");
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Active targets"
          value={totals.count}
          icon={<TargetIcon className="h-3.5 w-3.5" />}
        />
        <StatCard label="Target value" value={totals.target ? amount(totals.target) : "—"} tone="blue" />
        <StatCard label="Achieved" value={totals.achieved ? amount(totals.achieved) : "—"} tone="mint" />
        <StatCard
          label="Achievement"
          value={totals.target ? `${Math.round((totals.achieved / totals.target) * 100)}%` : "—"}
          hint="Confirmed orders only"
          tone="lavender"
        />
      </div>

      <div className="card-soft min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="truncate text-sm font-semibold">Targets</h2>
          {admin ? (
            <Button size="sm" className="h-8" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New target
            </Button>
          ) : null}
        </div>
        <div className="p-3">
          {!ready ? (
            <TableSkeleton rows={3} />
          ) : !targets.length ? (
            <EmptyState
              title="No targets yet"
              description="Create a monthly, quarterly or yearly target to track achievement against confirmed orders."
            />
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {targets.map((t) => {
                const a = achievement(t);
                const owner = state.users.find((u) => u.id === t.assignedTo);
                return (
                  <li key={t.id} className="min-w-0 rounded-lg border p-3">
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.period} · {dateLabel(t.startDate)} – {dateLabel(t.endDate)} ·{" "}
                          {t.companyWide ? "Company-wide" : owner?.name || "Unassigned"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">
                        {amount(a.achieved, t.currency)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {amount(t.amount, t.currency)}
                        </span>
                      </p>
                    </div>
                    <Progress value={a.percent} className="mt-2 h-2" />
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
                      <Stat label="Achievement" value={`${Math.round(a.percent)}%`} />
                      <Stat label="Remaining" value={amount(a.remaining, t.currency)} />
                      <Stat label="Orders" value={String(a.orders)} />
                      <Stat label="Avg order" value={amount(a.avg, t.currency)} />
                      <Stat label="Days left" value={String(a.days)} />
                      <Stat label="Currency" value={t.currency} />
                    </dl>
                    {admin ? (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setState((s) => ({
                              ...s,
                              targets: s.targets.map((x) =>
                                x.id === t.id ? { ...x, archived: true } : x,
                              ),
                            }));
                            toast.success("Target archived");
                          }}
                        >
                          Archive
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New target</DialogTitle>
            <DialogDescription>
              Achievement is measured from confirmed orders in the same currency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Target name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. March 2026 — USA team"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Period">
                <Select
                  value={form.period}
                  onValueChange={(v) => {
                    const period = v as TargetPeriod;
                    const end = periodRange(period, form.startDate);
                    setForm({ ...form, period, ...(end ? { endDate: end } : {}) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Currency">
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm({ ...form, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.settings.currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    const end = periodRange(form.period, startDate);
                    setForm({ ...form, startDate, ...(end ? { endDate: end } : {}) });
                  }}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </Field>
              <Field label="Target amount">
                <Input
                  inputMode="decimal"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </Field>
              <Field label="Applies to">
                <Select
                  value={form.companyWide ? "company" : (form.assignedTo ?? "")}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      companyWide: v === "company",
                      assignedTo: v === "company" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company-wide</SelectItem>
                    {state.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Create target</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
