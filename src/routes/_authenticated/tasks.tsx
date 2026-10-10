import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatCard, StatusPill, EmptyState, Pager, SearchInput, TableSkeleton } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, uid } from "@/lib/store";
import { dateLabel, isOverdue, isToday, pct, todayIso } from "@/lib/format";
import type { Task } from "@/lib/types";
import { useQuickAdd } from "@/lib/use-quick-add";
import { useDebounced } from "@/lib/use-debounced";

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (s: Record<string, unknown>): { view?: string; status?: string } => ({
    ...(typeof s['view'] === "string" ? { view: s['view'] as string } : {}),
    ...(typeof s['status'] === "string" ? { status: s['status'] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Tasks — LEPDO Sales CRM" },
      { name: "description", content: "Daily priorities, due dates and goal-linked tasks for the LEPDO sales team." },
      { property: "og:title", content: "Tasks — LEPDO Sales CRM" },
      { property: "og:description", content: "Plan daily sales priorities and track completion." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";

  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const sp = Route.useSearch();
  const [view, setView] = useState<"list" | "today" | "week">(
    (sp.view as "list" | "today" | "week") ?? "list",
  );
  const [statusFilter, setStatusFilter] = useState(sp.status ?? "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const blank = (): Task => ({
    id: "", title: "", description: "", relatedTo: "", assignedTo: user.id, startDate: todayIso(),
    dueDate: todayIso(), dueTime: "10:00", priority: "Medium", status: "To Do", goalCategory: "Prospecting",
    reminder: true, notes: "",
  });
  const [form, setForm] = useState<Task>(blank());

  useQuickAdd("task", () => { setEditing(null); setForm(blank()); setOpen(true); });

  const visible = useMemo(
    () => state.tasks.filter((t) => !t.archived && (admin || t.assignedTo === user.id)),
    [state.tasks, admin, user.id],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    return visible.filter((t) => {
      if (term && !`${t.title} ${t.relatedTo}`.toLowerCase().includes(term)) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (view === "today" && !isToday(t.dueDate)) return false;
      if (view === "week" && !(t.dueDate >= todayIso() && t.dueDate <= weekEnd)) return false;
      return true;
    });
  }, [visible, q, statusFilter, priorityFilter, view]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const done = visible.filter((t) => t.status === "Completed").length;

  const summary = [
    { label: "Today", value: visible.filter((t) => isToday(t.dueDate) && t.status !== "Completed").length, tone: "blue" as const },
    { label: "Pending", value: visible.filter((t) => t.status === "To Do" || t.status === "In Progress").length, tone: "yellow" as const },
    { label: "Completed", value: done, tone: "mint" as const },
    { label: "Overdue", value: visible.filter((t) => isOverdue(t.dueDate) && t.status !== "Completed").length, tone: "rose" as const },
    { label: "High Priority", value: visible.filter((t) => t.priority === "High" || t.priority === "Urgent").length, tone: "peach" as const },
    { label: "Goal-Related", value: visible.filter((t) => t.goalCategory === "Goal").length, tone: "lavender" as const },
  ];

  function save() {
    if (!form.title.trim()) { toast.error("Task title is required."); return; }
    if (!form.dueDate) { toast.error("Due date is required."); return; }
    setState((s) => ({
      ...s,
      tasks: editing ? s.tasks.map((t) => (t.id === editing.id ? { ...form, id: editing.id } : t)) : [{ ...form, id: uid("t") }, ...s.tasks],
    }));
    toast.success(editing ? "Task updated" : "Task added");
    setOpen(false);
  }

  if (!hydrated) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {summary.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="card-soft p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Completion progress</span>
          <span>{pct(done, visible.length)}%</span>
        </div>
        <Progress value={pct(done, visible.length)} className="h-2" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => { setEditing(null); setForm(blank()); setOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Task
        </Button>
        <SearchInput className="w-full sm:w-64" value={search} onChange={setSearch} placeholder="Search tasks…" />
        <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["To Do", "In Progress", "Completed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {["Low", "Medium", "High", "Urgent"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={!search && !statusFilter && !priorityFilter}
          onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setPage(1); }}
        >
          Clear filters
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {visible.length} tasks
        </span>
      </div>

      <Tabs value={view} onValueChange={(v) => { setView(v as typeof view); setPage(1); }}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="list">All tasks</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
        </TabsList>
        <TabsContent value={view} className="mt-3">
          <div className="card-soft">
            <ul className="divide-y">
              {paged.map((t) => (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`truncate text-sm font-medium ${t.status === "Completed" ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                      <StatusPill value={t.priority} />
                      <StatusPill value={t.status} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.relatedTo ? `${t.relatedTo} · ` : ""}
                      <span className={isOverdue(t.dueDate) && t.status !== "Completed" ? "text-destructive" : ""}>
                        Due {dateLabel(t.dueDate)} {t.dueTime}
                      </span>
                      {admin && ` · ${state.users.find((u) => u.id === t.assignedTo)?.name ?? ""}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {t.status !== "Completed" && (
                      <Button size="sm" className="h-8" onClick={() => { setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, status: "Completed" } : x)) })); toast.success("Task completed"); }}>
                        Complete
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8" onClick={() => { const next = new Date(Date.now() + 86400000).toISOString().slice(0, 10); setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, dueDate: next } : x)) })); toast.success("Rescheduled to tomorrow"); }}>
                      Reschedule
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(t); setForm(t); setOpen(true); }}>Edit</Button>
                  </div>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && <div className="p-4"><EmptyState title="No tasks here" description="Add a task or change the view." /></div>}
            <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "Add task"}</DialogTitle>
            <DialogDescription>Title and due date are required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Title *</Label><Input className="h-9" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Related customer / lead</Label><Input className="h-9" value={form.relatedTo} onChange={(e) => setForm({ ...form, relatedTo: e.target.value })} /></div>
            {admin && (
              <div className="space-y-1"><Label className="text-xs">Assigned user</Label>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                  {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><Label className="text-xs">Start date</Label><Input type="date" className="h-9" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Due date *</Label><Input type="date" className="h-9" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Due time</Label><Input type="time" className="h-9" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Priority</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}>
                {["Low", "Medium", "High", "Urgent"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}>
                {["To Do", "In Progress", "Completed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Goal category</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.goalCategory} onChange={(e) => setForm({ ...form, goalCategory: e.target.value })}>
                {["Prospecting", "Follow-Up", "Quotation", "Billing", "Data Entry", "Leads", "Goal"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Add task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
