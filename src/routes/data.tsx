import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Link2, Plus, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  StatCard,
  StatusPill,
  EmptyState,
  Pager,
  SearchInput,
  TableSkeleton,
  DemoTag,
} from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, uid, logActivity } from "@/lib/store";
import { dateLabel, todayIso } from "@/lib/format";
import { nextFollowUpDate, timezoneLabel } from "@/lib/links";
import { downloadTemplate, exportCsv, exportExcel, parseSpreadsheet } from "@/lib/io";
import { fetchBusinessFromLink } from "@/lib/fetch-link.functions";
import type { DataRecord } from "@/lib/types";
import { useQuickAdd } from "@/lib/use-quick-add";
import { useDebounced } from "@/lib/use-debounced";

export const Route = createFileRoute("/data")({
  validateSearch: (s: Record<string, unknown>): { status?: string } => ({
    ...(typeof s['status'] === "string" ? { status: s['status'] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Prospect Data — LEPDO Sales CRM" },
      {
        name: "description",
        content: "Store, import, enrich and organise prospect records with filters, tags and owners.",
      },
      { property: "og:title", content: "Prospect Data — LEPDO Sales CRM" },
      { property: "og:description", content: "Import, enrich and organise LEPDO prospect records." },
    ],
  }),
  component: DataPage,
});

const EMPTY: Omit<DataRecord, "id" | "createdAt" | "updatedAt" | "createdBy" | "assignedTo"> = {
  company: "",
  contactPerson: "",
  country: "",
  city: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  source: "Website",
  productInterest: "",
  category: "Loose Diamonds",
  status: "New",
  tags: [],
  nextFollowUp: null,
  notes: "",
};

function DataPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";

  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const sp = Route.useSearch();
  const [filters, setFilters] = useState({
    country: "",
    source: "",
    status: sp.status ?? "",
    tag: "",
    seller: "",
    from: "",
    to: "",
    hasPhone: false,
    hasWhatsapp: false,
    hasEmail: false,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [form, setForm] = useState({ ...EMPTY, assignedTo: user.id });
  const [importOpen, setImportOpen] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);

  useQuickAdd("data", () => {
    setEditing(null);
    setForm({ ...EMPTY, assignedTo: user.id });
    setFormOpen(true);
  });

  const visible = useMemo(
    () =>
      state.data.filter(
        (d) =>
          !d.archived && (admin || d.assignedTo === user.id || d.createdBy === user.id),
      ),
    [state.data, admin, user.id],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visible.filter((d) => {
      if (term && !`${d.company} ${d.contactPerson} ${d.email} ${d.phone} ${d.country}`.toLowerCase().includes(term))
        return false;
      if (filters.country && d.country !== filters.country) return false;
      if (filters.source && d.source !== filters.source) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.tag && !d.tags.includes(filters.tag)) return false;
      if (filters.seller && d.assignedTo !== filters.seller) return false;
      if (filters.from && d.createdAt < filters.from) return false;
      if (filters.to && d.createdAt > filters.to) return false;
      if (filters.hasPhone && !d.phone) return false;
      if (filters.hasWhatsapp && !d.whatsapp) return false;
      if (filters.hasEmail && !d.email) return false;
      return true;
    });
  }, [visible, q, filters]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sellerName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  const summary = [
    { label: "Total Records", value: visible.length, tone: "blue" as const },
    { label: "New", value: visible.filter((d) => d.status === "New").length, tone: "lavender" as const },
    { label: "Contacted", value: visible.filter((d) => d.status === "Contacted").length, tone: "mint" as const },
    { label: "Follow-Up Required", value: visible.filter((d) => d.status === "Follow-Up Required").length, tone: "yellow" as const },
    { label: "Converted to Lead", value: visible.filter((d) => d.status === "Converted to Lead").length, tone: "peach" as const },
    { label: "Invalid / Rejected", value: visible.filter((d) => d.status === "Invalid").length, tone: "rose" as const },
    { label: "Countries Covered", value: new Set(visible.map((d) => d.country)).size, tone: "blue" as const },
    {
      label: "Added This Month",
      value: visible.filter((d) => d.createdAt.slice(0, 7) === todayIso().slice(0, 7)).length,
      tone: "mint" as const,
    },
  ];

  function saveRecord() {
    if (!form.company.trim()) {
      toast.error("Company name is required.");
      return;
    }
    if (!editing && !form.phone && !form.email) {
      toast.error("Add at least a phone number or an email.");
      return;
    }
    const duplicate = visible.find(
      (d) =>
        d.id !== editing?.id &&
        (d.company.toLowerCase() === form.company.trim().toLowerCase() ||
          (!!form.email && d.email.toLowerCase() === form.email.toLowerCase())),
    );
    if (duplicate && !editing) {
      toast.warning(`Possible duplicate of "${duplicate.company}" — saved anyway, please review.`);
    }
    setState((s) => {
      if (editing) {
        return {
          ...s,
          data: s.data.map((d) =>
            d.id === editing.id ? { ...d, ...form, updatedAt: todayIso() } : d,
          ),
        };
      }
      const record: DataRecord = {
        ...form,
        id: uid("d"),
        createdAt: todayIso(),
        updatedAt: todayIso(),
        createdBy: s.currentUserId,
      };
      return { ...s, data: [record, ...s.data] };
    });
    logActivity({
      action: editing ? "Data record updated" : "Data record created",
      module: "Data",
      record: form.company,
    });
    toast.success(editing ? "Record updated" : "Record added");
    setFormOpen(false);
  }

  function archive(ids: string[]) {
    const snapshot = state.data;
    setState((s) => ({
      ...s,
      data: s.data.map((d) => (ids.includes(d.id) ? { ...d, archived: true } : d)),
    }));
    setSelected([]);
    toast.success(`${ids.length} record(s) archived`, {
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => setState((s) => ({ ...s, data: snapshot })),
      },
    });
  }

  function convertToLead(record: DataRecord) {
    setState((s) => ({
      ...s,
      data: s.data.map((d) => (d.id === record.id ? { ...d, status: "Converted to Lead" } : d)),
      leads: [
        {
          id: `L-${1000 + s.leads.length + 1}`,
          createdAt: todayIso(),
          company: record.company,
          contactPerson: record.contactPerson,
          country: record.country,
          phone: record.phone,
          whatsapp: record.whatsapp,
          email: record.email,
          source: record.source,
          assignedTo: record.assignedTo,
          priority: "Medium",
          value: 0,
          stage: "New",
          nextFollowUp: null,
          notes: record.notes,
          requirement: {
            productType: record.category,
            shape: "",
            caratRange: "",
            colour: "",
            clarity: "",
            cut: "",
            certification: "",
            quantity: "",
            targetPrice: "",
            metalType: "",
            jewelryType: "",
            deadline: "",
            instructions: "",
          },
        },
        ...s.leads,
      ],
    }));
    logActivity({ action: "Converted to lead", module: "Data", record: record.company });
    toast.success("Converted to lead");
  }

  const exportRows = () =>
    filtered.map((d) => ({
      Company: d.company,
      "Contact Person": d.contactPerson,
      Country: d.country,
      City: d.city,
      Phone: d.phone,
      WhatsApp: d.whatsapp,
      Email: d.email,
      Website: d.website,
      Source: d.source,
      "Product Interest": d.productInterest,
      Status: d.status,
      Tags: d.tags.join(", "),
      "Assigned Seller": sellerName(d.assignedTo),
      "Next Follow-Up": nextFollowUp(d) ?? "",
      "Date Added": d.createdAt,

    }));

  const nextFollowUp = (d: DataRecord) =>
    nextFollowUpDate(state, { id: d.id, company: d.company, nextFollowUp: d.nextFollowUp });

  const toggle = (id: string) =>
    setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const expandButton = (d: DataRecord) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
      aria-expanded={expanded.includes(d.id)}
      aria-label={`${expanded.includes(d.id) ? "Hide" : "Show"} details for ${d.company}`}
      onClick={() => toggle(d.id)}
    >
      {expanded.includes(d.id) ? (
        <ChevronUp className="mr-1 h-3.5 w-3.5" />
      ) : (
        <ChevronDown className="mr-1 h-3.5 w-3.5" />
      )}
      Details
    </Button>
  );

  const details = (d: DataRecord) => (
    <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {[
        ["WhatsApp", d.whatsapp || "—"],
        ["Email", d.email || "—"],
        ["Website", d.website || "—"],
        ["Source", d.source || "—"],
        ["Product interest", d.productInterest || "—"],
        ["Category", d.category || "—"],
        ["Assigned seller", sellerName(d.assignedTo)],
        ["Tags", d.tags.join(", ") || "—"],
        ["Date added", dateLabel(d.createdAt)],
        ["Last updated", dateLabel(d.updatedAt)],
        ["Notes", d.notes || "—"],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );

  const rowMenu = (d: DataRecord) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 shrink-0" aria-label={`Actions for ${d.company}`}>
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => { setEditing(d); setForm({ ...d }); setFormOpen(true); }}>
          View / Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setState((s) => ({
              ...s,
              followUps: [
                {
                  id: uid("f"), company: d.company, contactPerson: d.contactPerson, country: d.country,
                  phone: d.phone, whatsapp: d.whatsapp, channel: "WhatsApp", lastContact: null,
                  nextDate: todayIso(), nextTime: "10:00", status: "Pending", priority: "Medium",
                  tags: d.tags, assignedTo: d.assignedTo, notes: "", completed: false,
                  relatedId: d.id, dataId: d.id,
                },
                ...s.followUps,
              ],
            }));
            toast.success("Follow-up created");
          }}
        >
          Add Follow-Up
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => convertToLead(d)}>Convert to Lead</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setState((s) => ({
              ...s,
              tasks: [
                {
                  id: uid("t"), title: `Contact ${d.company}`, description: "", relatedTo: d.company,
                  relatedDataId: d.id, assignedTo: d.assignedTo, startDate: todayIso(), dueDate: todayIso(),
                  dueTime: "10:00", priority: "Medium", status: "To Do", goalCategory: "Prospecting",
                  reminder: true, notes: "",
                },
                ...s.tasks,
              ],
            }));
            toast.success("Task created");
          }}
        >
          Create Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => archive([d.id])}>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!hydrated) return <TableSkeleton rows={10} />;


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {summary.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => { setEditing(null); setForm({ ...EMPTY, assignedTo: user.id }); setFormOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Record
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1.5 h-4 w-4" /> Import Excel / CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => setFetchOpen(true)}>
          <Link2 className="mr-1.5 h-4 w-4" /> Fetch From Link
        </Button>
        <Button size="sm" variant="outline" onClick={downloadTemplate}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Sample Template
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => exportCsv(exportRows(), "lepdo-data")}>
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportExcel(exportRows(), "lepdo-data")}>
              Export Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="card-soft">
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search company, contact, email…" />
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
            <option value="">All countries</option>
            {state.settings.countries.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">All sources</option>
            {state.settings.sources.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {["New", "Contacted", "Follow-Up Required", "Converted to Lead", "Invalid"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })}>
            <option value="">All tags</option>
            {state.settings.tags.map((c) => <option key={c}>{c}</option>)}
          </select>
          {admin && (
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={filters.seller} onChange={(e) => setFilters({ ...filters, seller: e.target.value })}>
              <option value="">All sellers</option>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <Input type="date" className="h-9" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="From date" />
          <Input type="date" className="h-9" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="To date" />
          <div className="col-span-full flex flex-wrap items-center gap-3 text-xs">
            {(["hasPhone", "hasWhatsapp", "hasEmail"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <Checkbox checked={filters[k]} onCheckedChange={(v) => setFilters({ ...filters, [k]: !!v })} />
                {k === "hasPhone" ? "Has phone" : k === "hasWhatsapp" ? "Has WhatsApp" : "Has email"}
              </label>
            ))}
            <Button variant="ghost" size="sm" className="h-7" onClick={() => { setFilters({ country: "", source: "", status: "", tag: "", seller: "", from: "", to: "", hasPhone: false, hasWhatsapp: false, hasEmail: false }); setSearch(""); }}>
              Clear Filters
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Dates shown in {timezoneLabel()}
            </span>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/40 px-3 py-2 text-xs">
            <span>{selected.length} selected</span>
            <select
              className="h-8 rounded-md border bg-background px-2"
              defaultValue=""
              onChange={(e) => {
                const status = e.target.value as DataRecord["status"];
                if (!status) return;
                setState((s) => ({ ...s, data: s.data.map((d) => (selected.includes(d.id) ? { ...d, status } : d)) }));
                toast.success("Status updated");
              }}
            >
              <option value="">Bulk status…</option>
              {["New", "Contacted", "Follow-Up Required", "Converted to Lead", "Invalid"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              className="h-8 rounded-md border bg-background px-2"
              defaultValue=""
              onChange={(e) => {
                const tag = e.target.value;
                if (!tag) return;
                setState((s) => ({ ...s, data: s.data.map((d) => (selected.includes(d.id) && !d.tags.includes(tag) ? { ...d, tags: [...d.tags, tag] } : d)) }));
                toast.success("Tag added");
              }}
            >
              <option value="">Bulk tag…</option>
              {state.settings.tags.map((c) => <option key={c}>{c}</option>)}
            </select>
            {admin && (
              <select
                className="h-8 rounded-md border bg-background px-2"
                defaultValue=""
                onChange={(e) => {
                  const assignedTo = e.target.value;
                  if (!assignedTo) return;
                  setState((s) => ({ ...s, data: s.data.map((d) => (selected.includes(d.id) ? { ...d, assignedTo } : d)) }));
                  logActivity({ action: "Records reassigned", module: "Data", record: `${selected.length} records` });
                  toast.success("Seller assigned");
                }}
              >
                <option value="">Assign seller…</option>
                {state.users.filter((u) => u.role === "seller").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <Button size="sm" variant="outline" className="h-8" onClick={() => archive(selected)}>Archive</Button>
          </div>
        )}

        {/* Mobile: stacked cards */}
        <ul className="divide-y md:hidden">
          {paged.map((d) => (
            <li key={d.id} className="space-y-2 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  className="mt-1"
                  checked={selected.includes(d.id)}
                  onCheckedChange={(v) => setSelected(v ? [...selected, d.id] : selected.filter((x) => x !== d.id))}
                  aria-label={`Select ${d.company}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium break-words">{d.company}</span>
                    {d.demo && <DemoTag />}
                  </div>
                  <p className="text-xs break-words text-muted-foreground">
                    {[d.contactPerson, d.city, d.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {rowMenu(d)}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusPill value={d.status} />
                <span className="text-muted-foreground">Next: {dateLabel(nextFollowUp(d))}</span>
                <span className="text-muted-foreground">{sellerName(d.assignedTo)}</span>
              </div>
              {expandButton(d)}
              {expanded.includes(d.id) && details(d)}
            </li>
          ))}
        </ul>

        {/* Desktop: essential columns only, details expand in place */}
        <div className="hidden md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-9" />
              <col />
              <col className="w-[16%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">
                  <Checkbox
                    checked={paged.length > 0 && paged.every((d) => selected.includes(d.id))}
                    onCheckedChange={(v) => setSelected(v ? paged.map((d) => d.id) : [])}
                    aria-label="Select all"
                  />
                </th>
                {["Company", "Location", "Contact", "Status", "Next follow-up", ""].map((h) => (
                  <th key={h} className="p-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((d) => (
                <Fragment key={d.id}>
                  <tr className="border-t align-top hover:bg-accent/30">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.includes(d.id)}
                        onCheckedChange={(v) => setSelected(v ? [...selected, d.id] : selected.filter((x) => x !== d.id))}
                        aria-label={`Select ${d.company}`}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium break-words">{d.company}</span>
                        {d.demo && <DemoTag />}
                      </div>
                      <div className="text-xs break-words text-muted-foreground">{d.contactPerson || "—"}</div>
                      {expandButton(d)}
                    </td>
                    <td className="p-2 text-xs break-words">
                      {d.country || "—"}
                      {d.city ? <div className="text-muted-foreground">{d.city}</div> : null}
                    </td>
                    <td className="p-2 text-xs break-words">
                      <div>{d.phone || "—"}</div>
                      <div className="text-muted-foreground">{d.email || "—"}</div>
                    </td>
                    <td className="p-2"><StatusPill value={d.status} /></td>
                    <td className="p-2 text-xs">{dateLabel(nextFollowUp(d))}</td>
                    <td className="p-2 text-right">{rowMenu(d)}</td>
                  </tr>
                  {expanded.includes(d.id) && (
                    <tr className="border-t bg-muted/30">
                      <td />
                      <td colSpan={6} className="p-2">{details(d)}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState title="No records found" description="Try clearing filters, importing a file, or adding a record." />
          </div>
        )}
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>

      <RecordDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        onSave={saveRecord}
        editing={!!editing}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <FetchDialog open={fetchOpen} onOpenChange={setFetchOpen} />
    </div>
  );
}

type FormShape = typeof EMPTY & { assignedTo: string };

function RecordDialog({
  open, onOpenChange, form, setForm, onSave, editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormShape;
  setForm: (f: FormShape) => void;
  onSave: () => void;
  editing: boolean;
}) {
  const state = useCrm((s) => s);
  const admin = useCurrentUser().role === "super_admin";
  const field = (key: keyof FormShape, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={key} className="text-xs">{label}</Label>
      <Input
        id={key}
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="h-9"
      />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit record" : "Add prospect record"}</DialogTitle>
          <DialogDescription>Company name and one contact detail are required.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("company", "Company *")}
          {field("contactPerson", "Contact person")}
          {field("country", "Country")}
          {field("city", "City")}
          {field("phone", "Phone")}
          {field("whatsapp", "WhatsApp")}
          {field("email", "Email", "email")}
          {field("website", "Website")}
          {field("productInterest", "Product interest")}
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {state.settings.sources.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormShape["status"] })}>
              {["New", "Contacted", "Follow-Up Required", "Converted to Lead", "Invalid"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {admin && (
            <div className="space-y-1">
              <Label className="text-xs">Assigned seller</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Next follow-up</Label>
            <Input type="date" className="h-9" value={form.nextFollowUp ?? ""} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value || null })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Tags (comma separated)</Label>
            <Input className="h-9" value={form.tags.join(", ")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave}>{editing ? "Save changes" : "Add record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PreviewRow {
  row: number;
  values: Record<string, string>;
  errors: string[];
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const parsed = await parseSpreadsheet(file);
      const seen = new Set(state.data.map((d) => d.company.toLowerCase()));
      setRows(
        parsed.map((r, i) => {
          const values: Record<string, string> = {
            company: r["Company"] ?? r["company"] ?? "",
            contactPerson: r["Contact Person"] ?? "",
            country: r["Country"] ?? "",
            city: r["City"] ?? "",
            phone: r["Phone"] ?? "",
            whatsapp: r["WhatsApp"] ?? "",
            email: r["Email"] ?? "",
            website: r["Website"] ?? "",
            source: r["Source"] ?? "Import",
            productInterest: r["Product Interest"] ?? "",
            tags: r["Tags"] ?? "",
            notes: r["Notes"] ?? "",
          };
          const errors: string[] = [];
          if (!values["company"]) errors.push("Company is missing");
          if (!values["phone"] && !values["email"]) errors.push("No phone or email");
          if (values["email"] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values["email"]!))
            errors.push("Invalid email");
          if (values["company"] && seen.has(values["company"]!.toLowerCase())) errors.push("Duplicate company");
          return { row: i + 2, values, errors };
        }),
      );
    } catch {
      toast.error("Could not read this file. Please use the sample template.");
    }
    setBusy(false);
  }

  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? [];

  function commit() {
    setState((s) => ({
      ...s,
      data: [
        ...valid.map((r) => ({
          id: uid("d"),
          createdAt: todayIso(),
          updatedAt: todayIso(),
          company: r.values["company"]!,
          contactPerson: r.values["contactPerson"] ?? "",
          country: r.values["country"] ?? "",
          city: r.values["city"] ?? "",
          phone: r.values["phone"] ?? "",
          whatsapp: r.values["whatsapp"] ?? "",
          email: r.values["email"] ?? "",
          website: r.values["website"] ?? "",
          source: r.values["source"] ?? "Import",
          productInterest: r.values["productInterest"] ?? "",
          category: "Loose Diamonds",
          assignedTo: user.id,
          createdBy: user.id,
          status: "New" as const,
          tags: (r.values["tags"] ?? "").split(",").map((t) => t.trim()).filter(Boolean),
          nextFollowUp: null,
          notes: r.values["notes"] ?? "",
        })),
        ...s.data,
      ],
    }));
    logActivity({ action: "Data imported", module: "Data", record: `${valid.length} records` });
    toast.success(`${valid.length} records imported${invalid.length ? `, ${invalid.length} skipped` : ""}`);
    setRows(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setRows(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import prospect data</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file. Rows are checked before anything is saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="h-9 max-w-xs"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>Download sample template</Button>
          </div>
          {busy && <TableSkeleton rows={3} />}
          {rows && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-pastel-mint px-2 py-1">{valid.length} rows ready</span>
                <span className="rounded-full bg-pastel-rose px-2 py-1">{invalid.length} rows with issues</span>
              </div>
              <div className="scroll-x max-h-72 overflow-y-auto rounded-lg border">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      {["Row", "Company", "Contact", "Country", "Phone", "Email", "Result"].map((h) => (
                        <th key={h} className="p-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="p-2">{r.row}</td>
                        <td className="max-w-40 truncate p-2">{r.values["company"]}</td>
                        <td className="max-w-32 truncate p-2">{r.values["contactPerson"]}</td>
                        <td className="p-2">{r.values["country"]}</td>
                        <td className="p-2">{r.values["phone"]}</td>
                        <td className="max-w-40 truncate p-2">{r.values["email"]}</td>
                        <td className="p-2">
                          {r.errors.length ? (
                            <span className="text-destructive">{r.errors.join(", ")}</span>
                          ) : (
                            <span className="text-success">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid.length} onClick={commit}>Import {valid.length} rows</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FetchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const user = useCurrentUser();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  async function run() {
    if (!/^https?:\/\/.+/.test(url)) {
      toast.error("Please paste a full link starting with https://");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetchBusinessFromLink({ data: { url } });
      if (!res.ok) {
        setMessage(res.message ?? "Could not read this link.");
        setFields(null);
      } else {
        setFields(res.fields);
      }
    } catch {
      setMessage("Could not read this link. Please enter the details manually.");
    }
    setBusy(false);
  }

  function save() {
    if (!fields) return;
    const clean = (v?: string) => (v && v !== "Not Found" ? v : "");
    setState((s) => ({
      ...s,
      data: [
        {
          id: uid("d"),
          createdAt: todayIso(),
          updatedAt: todayIso(),
          company: clean(fields["company"]) || "Unknown business",
          contactPerson: clean(fields["contactPerson"]),
          country: clean(fields["country"]),
          city: clean(fields["city"]),
          phone: clean(fields["phone"]),
          whatsapp: clean(fields["whatsapp"]),
          email: clean(fields["email"]),
          website: clean(fields["website"]),
          source: clean(fields["source"]) || "Link fetch",
          productInterest: clean(fields["productInterest"]),
          category: "Loose Diamonds",
          assignedTo: s.currentUserId,
          createdBy: s.currentUserId,
          status: "New",
          tags: [],
          nextFollowUp: null,
          notes: [clean(fields["description"]), clean(fields["social"]), clean(fields["sourceUrl"])].filter(Boolean).join("\n"),
        },
        ...s.data,
      ],
    }));
    toast.success("Record saved from link");
    setFields(null);
    setUrl("");
    onOpenChange(false);
  }

  const labels: Record<string, string> = {
    company: "Business name", contactPerson: "Contact person", country: "Country", city: "City",
    website: "Website", email: "Email", phone: "Phone", whatsapp: "WhatsApp", social: "Social profile",
    category: "Business category", productInterest: "Product interest", source: "Source platform",
    sourceUrl: "Source URL", description: "Description", notes: "Notes",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fetch business details from a link</DialogTitle>
          <DialogDescription>
            Paste a public website, marketplace or business profile link. Only publicly available details are read —
            anything unavailable is marked “Not Found”.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/business-page"
            className="h-9 min-w-0 flex-1"
          />
          <Button onClick={() => void run()} disabled={busy}>{busy ? "Fetching…" : "Fetch"}</Button>
        </div>
        {busy && <TableSkeleton rows={4} />}
        {message && (
          <p className="rounded-lg bg-pastel-peach p-3 text-sm">{message} You can still add the record manually from the Data page.</p>
        )}
        {fields && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(labels).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{labels[k]}</Label>
                <Input
                  className="h-9"
                  value={fields[k] ?? ""}
                  onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!fields} onClick={save}>Save record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
