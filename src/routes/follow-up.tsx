import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, Copy, MessageCircle, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  StatCard,
  StatusPill,
  EmptyState,
  Pager,
  SearchInput,
  TableSkeleton,
} from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, uid, logActivity } from "@/lib/store";
import { dateLabel, isOverdue, isToday, todayIso } from "@/lib/format";
import type { FollowUp, FollowUpStatus } from "@/lib/types";
import { useQuickAdd } from "@/lib/use-quick-add";
import { useDebounced } from "@/lib/use-debounced";
import { timezoneLabel } from "@/lib/links";

export const Route = createFileRoute("/follow-up")({
  validateSearch: (s: Record<string, unknown>): { quick?: string } => ({
    ...(typeof s['quick'] === "string" ? { quick: s['quick'] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Follow-Up — LEPDO Sales CRM" },
      { name: "description", content: "Daily follow-up workspace with WhatsApp templates, statuses and rescheduling." },
      { property: "og:title", content: "Follow-Up — LEPDO Sales CRM" },
      { property: "og:description", content: "Run daily customer follow-ups in one fast list." },
    ],
  }),
  component: FollowUpPage,
});

const STATUSES: FollowUpStatus[] = [
  "Pending", "Contacted", "No Response", "Interested", "Requirement Received",
  "Quotation Sent", "Negotiation", "Follow-Up Later", "Converted", "Not Interested", "Invalid",
];

function FollowUpPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";

  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const sp = Route.useSearch();
  const [quick, setQuick] = useState<
    "all" | "today" | "tomorrow" | "week" | "overdue" | "pending" | "completed"
  >((sp.quick as "all") ?? "all");
  const [filters, setFilters] = useState({ country: "", seller: "", status: "", priority: "", channel: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [waFor, setWaFor] = useState<FollowUp | null>(null);
  const [doneFor, setDoneFor] = useState<FollowUp | null>(null);
  const [outcome, setOutcome] = useState<FollowUpStatus>("Contacted");
  const [nextAgain, setNextAgain] = useState({ on: false, date: todayIso(), time: "10:00" });

  const blank = (): FollowUp => ({
    id: "", company: "", contactPerson: "", country: "", phone: "", whatsapp: "", channel: "WhatsApp",
    lastContact: null, nextDate: todayIso(), nextTime: "10:00", status: "Pending", priority: "Medium",
    tags: [], assignedTo: user.id, notes: "", completed: false,
  });
  const [form, setForm] = useState<FollowUp>(blank());

  useQuickAdd("followup", () => { setEditing(null); setForm(blank()); setFormOpen(true); });

  const visible = useMemo(
    () => state.followUps.filter((f) => !f.archived && (admin || f.assignedTo === user.id)),
    [state.followUps, admin, user.id],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const today = todayIso();
    const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return visible.filter((f) => {
      if (term && !`${f.company} ${f.contactPerson} ${f.country} ${f.phone}`.toLowerCase().includes(term)) return false;
      if (quick === "today" && f.nextDate !== today) return false;
      if (quick === "tomorrow" && f.nextDate !== tomorrow) return false;
      if (quick === "week" && !(f.nextDate >= today && f.nextDate <= weekEnd)) return false;
      if (quick === "overdue" && !(isOverdue(f.nextDate) && !f.completed)) return false;
      if (quick === "pending" && f.completed) return false;
      if (quick === "completed" && !f.completed) return false;
      if (filters.country && f.country !== filters.country) return false;
      if (filters.seller && f.assignedTo !== filters.seller) return false;
      if (filters.status && f.status !== filters.status) return false;
      if (filters.priority && f.priority !== filters.priority) return false;
      if (filters.channel && f.channel !== filters.channel) return false;
      return true;
    });
  }, [visible, q, quick, filters]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sellerName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  const summary = [
    { label: "Today", value: visible.filter((f) => isToday(f.nextDate) && !f.completed).length, tone: "blue" as const },
    { label: "Pending", value: visible.filter((f) => !f.completed).length, tone: "yellow" as const },
    { label: "Completed", value: visible.filter((f) => f.completed).length, tone: "mint" as const },
    { label: "Overdue", value: visible.filter((f) => isOverdue(f.nextDate) && !f.completed).length, tone: "rose" as const },
    { label: "Interested", value: visible.filter((f) => f.status === "Interested").length, tone: "mint" as const },
    { label: "No Response", value: visible.filter((f) => f.status === "No Response").length, tone: "lavender" as const },
    { label: "Not Interested", value: visible.filter((f) => f.status === "Not Interested").length, tone: "peach" as const },
    { label: "Countries", value: new Set(visible.map((f) => f.country)).size, tone: "blue" as const },
  ];

  function save() {
    if (!form.company.trim()) { toast.error("Customer or company is required."); return; }
    if (!form.nextDate) { toast.error("Next follow-up date is required."); return; }
    setState((s) => ({
      ...s,
      followUps: editing
        ? s.followUps.map((f) => (f.id === editing.id ? { ...form, id: editing.id } : f))
        : [{ ...form, id: uid("f") }, ...s.followUps],
    }));
    toast.success(editing ? "Follow-up updated" : "Follow-up added");
    setFormOpen(false);
  }

  function update(id: string, patch: Partial<FollowUp>, label: string) {
    setState((s) => ({ ...s, followUps: s.followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
    toast.success(label);
  }

  /**
   * Completion is separate from the contact status: finishing an activity keeps
   * the outcome on the completed row and, when a next contact is scheduled,
   * creates a brand new pending activity for the same customer.
   */
  function completeFollowUp(
    f: FollowUp,
    result: FollowUpStatus,
    next?: { date: string; time: string },
  ) {
    setState((s) => {
      const followUps = s.followUps.map((row) =>
        row.id === f.id
          ? { ...row, completed: true, status: result, outcome: result, lastContact: todayIso() }
          : row,
      );
      if (next?.date) {
        followUps.unshift({
          ...f,
          id: uid("f"),
          completed: false,
          status: "Pending",
          outcome: undefined,
          lastContact: todayIso(),
          nextDate: next.date,
          nextTime: next.time || "10:00",
          notes: "",
        });
      }
      return { ...s, followUps };
    });
    logActivity({
      action: next?.date ? "Follow-up completed and rescheduled" : "Follow-up completed",
      module: "Follow-Up",
      record: f.company,
      from: f.status,
      to: result,
    });
    toast.success(next?.date ? `Done · next contact ${dateLabel(next.date)}` : "Follow-up marked done");
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Copy is blocked in this browser.");
    }
  };

  const messageFor = (f: FollowUp) =>
    (state.settings.templates[0]?.body ?? "Hello {{name}},").replace(
      "{{name}}",
      f.contactPerson || f.company || "there",
    );

  const openWhatsApp = (f: FollowUp) => {
    const num = (f.whatsapp || f.phone).replace(/[^\d]/g, "");
    if (!num) { toast.error("No WhatsApp number saved for this customer."); return; }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(messageFor(f))}`, "_blank", "noopener");
  };

  const activeFilters =
    Object.values(filters).filter(Boolean).length + (quick !== "all" ? 1 : 0) + (search ? 1 : 0);

  function clearFilters() {
    setFilters({ country: "", seller: "", status: "", priority: "", channel: "" });
    setQuick("all");
    setSearch("");
    setPage(1);
  }

  if (!hydrated) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {summary.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => { setEditing(null); setForm(blank()); setFormOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Follow-Up
        </Button>
        {(["all", "today", "tomorrow", "week", "overdue", "pending", "completed"] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={quick === k ? "default" : "outline"}
            className="h-8 capitalize"
            onClick={() => { setQuick(k); setPage(1); }}
          >
            {k === "week" ? "This week" : k}
          </Button>
        ))}
      </div>

      <div className="card-soft">
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customer or number…" />
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
            <option value="">All countries</option>
            {state.settings.countries.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">All priorities</option>
            {["Low", "Medium", "High", "Urgent"].map((c) => <option key={c}>{c}</option>)}
          </select>
          {admin ? (
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.seller} onChange={(e) => setFilters({ ...filters, seller: e.target.value })}>
              <option value="">All sellers</option>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : (
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
              <option value="">All channels</option>
              {["WhatsApp", "Call", "Email"].map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span>
            {filtered.length} of {visible.length} follow-ups · dates shown in {timezoneLabel()}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={activeFilters === 0}
            onClick={clearFilters}
          >
            Clear filters{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[26%] p-2 font-medium">Customer</th>
                <th className="w-[20%] p-2 font-medium">Contact</th>
                <th className="w-[16%] p-2 font-medium">Next follow-up</th>
                <th className="w-[18%] p-2 font-medium">Status</th>
                <th className="w-[20%] p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((f) => (
                <tr key={f.id} className="border-t align-top hover:bg-accent/30">
                  <td className="min-w-0 p-2">
                    <div className="truncate font-medium">{f.company}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[f.contactPerson, f.country].filter(Boolean).join(" · ")}
                    </div>
                    {f.notes ? (
                      <div className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">
                        {f.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="min-w-0 p-2 text-xs">
                    <div className="truncate">{f.phone || "—"}</div>
                    <div className="truncate text-muted-foreground">{f.whatsapp || "—"}</div>
                    <div className="truncate text-muted-foreground">{sellerName(f.assignedTo)}</div>
                  </td>
                  <td className="min-w-0 p-2 text-xs">
                    <div className={isOverdue(f.nextDate) && !f.completed ? "text-destructive" : ""}>
                      {dateLabel(f.nextDate)} · {f.nextTime}
                    </div>
                    <div className="text-muted-foreground">Last: {dateLabel(f.lastContact)}</div>
                  </td>
                  <td className="min-w-0 space-y-1 p-2">
                    <StatusPill value={f.status} />
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusPill value={f.priority} />
                      <span className="text-[11px] text-muted-foreground">
                        {f.completed ? "Completed" : "Pending"}
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Copy number" aria-label={`Copy number for ${f.company}`}
                        onClick={() => void copyText(f.whatsapp || f.phone, "Number copied")}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Copy message" aria-label={`Copy message for ${f.company}`}
                        onClick={() => void copyText(messageFor(f), "Message copied")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Open WhatsApp" aria-label={`Open WhatsApp chat with ${f.company}`}
                        onClick={() => openWhatsApp(f)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        title="Reschedule" aria-label={`Reschedule follow-up with ${f.company}`}
                        onClick={() => {
                          setDoneFor(f);
                          setOutcome(f.status === "Pending" ? "Contacted" : f.status);
                          setNextAgain({ on: true, date: todayIso(), time: f.nextTime || "10:00" });
                        }}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                      </Button>
                      {!f.completed && (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          title="Mark done" aria-label={`Mark follow-up with ${f.company} as done`}
                          onClick={() => {
                            setDoneFor(f);
                            setOutcome(f.status === "Pending" ? "Contacted" : f.status);
                            setNextAgain({ on: false, date: todayIso(), time: "10:00" });
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline" className="h-7"
                        onClick={() => { setEditing(f); setForm(f); setFormOpen(true); }}
                      >
                        Open
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {paged.map((f) => (
            <div key={f.id} className="space-y-2 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.company}</div>
                  <div className="truncate text-xs text-muted-foreground">{f.country} · {f.phone}</div>
                </div>
                <StatusPill value={f.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={isOverdue(f.nextDate) && !f.completed ? "text-destructive" : ""}>
                  Next: {dateLabel(f.nextDate)} {f.nextTime}
                </span>
                <StatusPill value={f.priority} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => void copyText(f.whatsapp || f.phone, "Number copied")}>Copy number</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => void copyText(messageFor(f), "Message copied")}>Copy message</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setWaFor(f)}>WhatsApp</Button>
                <Button
                  size="sm" variant="outline" className="h-8"
                  onClick={() => {
                    setDoneFor(f);
                    setOutcome(f.status === "Pending" ? "Contacted" : f.status);
                    setNextAgain({ on: true, date: todayIso(), time: f.nextTime || "10:00" });
                  }}
                >
                  Reschedule
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditing(f); setForm(f); setFormOpen(true); }}>Open</Button>
                {!f.completed && (
                  <Button
                    size="sm" className="h-8"
                    onClick={() => {
                      setDoneFor(f);
                      setOutcome(f.status === "Pending" ? "Contacted" : f.status);
                      setNextAgain({ on: false, date: todayIso(), time: "10:00" });
                    }}
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-4"><EmptyState title="No follow-ups here" description="Change the filter above or add a new follow-up." /></div>
        )}
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Follow-up editor */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Follow-up details" : "Add follow-up"}</DialogTitle>
            <DialogDescription>Record the result and schedule the next contact.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Customer / company *</Label>
              <Input className="h-9" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Contact person</Label>
              <Input className="h-9" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Country</Label>
              <Input className="h-9" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label>
              <Input className="h-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">WhatsApp</Label>
              <Input className="h-9" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Channel</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as FollowUp["channel"] })}>
                {["WhatsApp", "Call", "Email"].map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Next date *</Label>
              <Input type="date" className="h-9" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Next time</Label>
              <Input type="time" className="h-9" value={form.nextTime} onChange={(e) => setForm({ ...form, nextTime: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FollowUpStatus })}>
                {STATUSES.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Priority</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as FollowUp["priority"] })}>
                {["Low", "Medium", "High", "Urgent"].map((c) => <option key={c}>{c}</option>)}
              </select></div>
            {admin && (
              <div className="space-y-1"><Label className="text-xs">Assigned seller</Label>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                  {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><Label className="text-xs">Tags (comma separated)</Label>
              <Input className="h-9" value={form.tags.join(", ")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {editing && (
              <>
                <Button variant="outline" onClick={() => { update(editing.id, { completed: false }, "Marked pending"); setFormOpen(false); }}>Mark Pending</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
                    update(editing.id, { nextDate: next, completed: false }, "Rescheduled to " + next);
                    setFormOpen(false);
                  }}
                >
                  Reschedule +3 days
                </Button>
                <Button
                  onClick={() => {
                    update(editing.id, { ...form, completed: true, lastContact: todayIso() }, "Follow-up completed");
                    logActivity({ action: "Follow-up completed", module: "Follow-Up", record: form.company, to: form.status });
                    setFormOpen(false);
                  }}
                >
                  Mark Follow-Up Done
                </Button>
              </>
            )}
            <Button onClick={save}>{editing ? "Save changes" : "Add follow-up"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!doneFor} onOpenChange={(v) => !v && setDoneFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete follow-up — {doneFor?.company}</DialogTitle>
            <DialogDescription>
              The outcome stays on this activity. Scheduling a next contact creates a new pending
              follow-up instead of overwriting this one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Outcome of this contact</Label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as FollowUpStatus)}
              >
                {STATUSES.filter((s2) => s2 !== "Pending").map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={nextAgain.on}
                onChange={(e) => setNextAgain({ ...nextAgain, on: e.target.checked })}
              />
              Schedule the next contact
            </label>
            {nextAgain.on && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Next date ({timezoneLabel()})</Label>
                  <Input type="date" className="h-9" value={nextAgain.date}
                    onChange={(e) => setNextAgain({ ...nextAgain, date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Next time</Label>
                  <Input type="time" className="h-9" value={nextAgain.time}
                    onChange={(e) => setNextAgain({ ...nextAgain, time: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDoneFor(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!doneFor) return;
                if (nextAgain.on && !nextAgain.date) { toast.error("Choose the next contact date."); return; }
                if (nextAgain.on) {
                  completeFollowUp(doneFor, outcome, { date: nextAgain.date, time: nextAgain.time });
                } else {
                  completeFollowUp(doneFor, outcome);
                }
                setDoneFor(null);
              }}
            >
              Save outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppDialog followUp={waFor} onClose={() => setWaFor(null)} />
    </div>
  );
}

function WhatsAppDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const templates = useCrm((s) => s.settings.templates);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [message, setMessage] = useState("");

  const active = templates.find((t) => t.id === templateId);
  const text =
    message ||
    (active?.body ?? "").replace("{{name}}", followUp?.contactPerson || followUp?.company || "there");

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Copy is blocked in this browser.");
    }
  };

  return (
    <Dialog open={!!followUp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp — {followUp?.company}</DialogTitle>
          <DialogDescription>
            Nothing is sent automatically. Copy the number or the message, or open the chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input className="h-9" readOnly value={followUp?.whatsapp ?? ""} />
            <Button variant="outline" size="sm" onClick={() => copy(followUp?.whatsapp ?? "", "Number copied")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Message template</Label>
            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setMessage(""); }}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Textarea rows={4} value={text} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => copy(text, "Message copied")}>Copy message</Button>
          <Button
            onClick={() => {
              const num = (followUp?.whatsapp ?? "").replace(/[^\d]/g, "");
              window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
            }}
          >
            Open WhatsApp chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
