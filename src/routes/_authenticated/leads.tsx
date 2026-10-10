import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard, StatusPill, EmptyState, Pager, SearchInput, TableSkeleton } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, uid, logActivity } from "@/lib/store";
import { dateLabel, money, todayIso } from "@/lib/format";
import type { Lead, LeadStage } from "@/lib/types";
import { useQuickAdd } from "@/lib/use-quick-add";
import { useDebounced } from "@/lib/use-debounced";
import { nextFollowUpDate } from "@/lib/links";

export const Route = createFileRoute("/_authenticated/leads")({
  validateSearch: (s: Record<string, unknown>): { stage?: string } => ({
    ...(typeof s['stage'] === "string" ? { stage: s['stage'] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Leads — LEPDO Sales CRM" },
      { name: "description", content: "Track incoming leads, exact diamond and jewelry requirements and pipeline stages." },
      { property: "og:title", content: "Leads — LEPDO Sales CRM" },
      { property: "og:description", content: "Lead pipeline with requirements for lab-grown diamonds and jewelry." },
    ],
  }),
  component: LeadsPage,
});

const STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Requirement Received", "Quotation Sent", "Negotiation", "Won", "Lost"];

function LeadsPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const sp = Route.useSearch();
  const [stageFilter, setStageFilter] = useState(sp.stage ?? "");
  const [sellerFilter, setSellerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [lossFor, setLossFor] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState("");

  const blank = (): Lead => ({
    id: "", createdAt: todayIso(), company: "", contactPerson: "", country: "", phone: "", whatsapp: "",
    email: "", source: "Website", assignedTo: user.id, createdBy: user.id, priority: "Medium", value: 0, stage: "New",
    nextFollowUp: null, notes: "",
    requirement: { productType: "Lab-Grown Diamond", shape: "", caratRange: "", colour: "", clarity: "", cut: "", certification: "", quantity: "", targetPrice: "", metalType: "", jewelryType: "", deadline: "", instructions: "" },
  });
  const [form, setForm] = useState<Lead>(blank());

  useQuickAdd("lead", () => { setEditing(null); setForm(blank()); setOpen(true); });

  const visible = useMemo(
    () => state.leads.filter((l) => !l.archived && (admin || l.createdBy === user.id)),
    [state.leads, admin, user.id],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visible.filter((l) => {
      if (term && !`${l.id} ${l.company} ${l.contactPerson} ${l.country}`.toLowerCase().includes(term)) return false;
      if (stageFilter && l.stage !== stageFilter) return false;
      if (sellerFilter && l.assignedTo !== sellerFilter) return false;
      return true;
    });
  }, [visible, q, stageFilter, sellerFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sellerName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  const summary = [
    { label: "Total Leads", value: visible.length, tone: "blue" as const },
    ...STAGES.map((s, i) => ({
      label: s,
      value: visible.filter((l) => l.stage === s).length,
      tone: (["lavender", "mint", "yellow", "peach", "blue", "lavender", "mint", "rose"] as const)[i]!,
    })),
  ];

  function save() {
    if (!form.company.trim()) { toast.error("Company is required."); return; }
    if (!form.phone && !form.email) { toast.error("Add a phone number or an email."); return; }
    setState((s) => ({
      ...s,
      leads: editing
        ? s.leads.map((l) => (l.id === editing.id ? { ...form, id: editing.id } : l))
        : [{ ...form, id: `L-${1000 + s.leads.length + 1}` }, ...s.leads],
    }));
    toast.success(editing ? "Lead updated" : "Lead created");
    setOpen(false);
  }

  function setStage(lead: Lead, stage: LeadStage) {
    if (stage === "Lost") { setLossFor(lead); return; }
    setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === lead.id ? { ...l, stage } : l)) }));
    logActivity({ action: "Lead stage changed", module: "Leads", record: lead.id, from: lead.stage, to: stage });
    toast.success(`Moved to ${stage}`);
  }

  if (!hydrated) return <TableSkeleton rows={10} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-9">
        {summary.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => { setEditing(null); setForm(blank()); setOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Lead
        </Button>
        <SearchInput className="w-full sm:w-64" value={search} onChange={setSearch} placeholder="Search leads…" />
        <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {admin && (
          <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
            <option value="">All sellers</option>
            {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={!search && !stageFilter && !sellerFilter}
          onClick={() => { setSearch(""); setStageFilter(""); setSellerFilter(""); setPage(1); }}
        >
          Clear filters
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {visible.length} leads
        </span>
      </div>

      <Tabs defaultValue="table">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="table">Table view</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline view</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-3">
          <div className="card-soft">
            <div>
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[46%] p-2 font-medium sm:w-[28%]">Lead / customer</th>
                    <th className="hidden w-[26%] p-2 font-medium lg:table-cell">Requirement</th>
                    <th className="w-[18%] p-2 font-medium">Value &amp; stage</th>
                    <th className="hidden w-[16%] p-2 font-medium md:table-cell">Follow-up</th>
                    <th className="w-[24%] p-2 text-right font-medium sm:w-[12%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((l) => (
                    <tr key={l.id} className="border-t align-top hover:bg-accent/30">
                      <td className="min-w-0 p-2">
                        <div className="truncate font-medium">{l.company}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[l.contactPerson, l.country].filter(Boolean).join(" · ")}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {l.id} · {dateLabel(l.createdAt)} · Added by {sellerName(l.createdBy ?? "")}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs break-words text-muted-foreground lg:hidden">
                          {[l.requirement.productType, l.requirement.shape, l.requirement.caratRange, l.requirement.quantity].filter(Boolean).join(" · ") || "No requirement captured"}
                        </div>
                      </td>
                      <td className="hidden min-w-0 p-2 text-xs break-words text-muted-foreground lg:table-cell">
                        {[l.requirement.productType, l.requirement.shape, l.requirement.caratRange, l.requirement.colour, l.requirement.clarity, l.requirement.quantity].filter(Boolean).join(" · ") || "No requirement captured"}
                      </td>
                      <td className="min-w-0 space-y-1 p-2">
                        <div className="truncate font-medium">{money(l.value)}</div>
                        <StatusPill value={l.stage} />
                        <div><StatusPill value={l.priority} /></div>
                      </td>
                      <td className="hidden min-w-0 p-2 text-xs md:table-cell">
                        <div>{dateLabel(nextFollowUpDate(state, { id: l.id, dataId: l.dataId, company: l.company, nextFollowUp: l.nextFollowUp }))}</div>
                        <div className="truncate text-muted-foreground">Added by {sellerName(l.createdBy ?? "")}</div>
                      </td>
                      <td className="p-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Actions</Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(l); setForm(l); setOpen(true); }}>View / Edit</DropdownMenuItem>
                            {STAGES.filter((s) => s !== l.stage).map((s) => (
                              <DropdownMenuItem key={s} onSelect={() => setStage(l, s)}>Move to {s}</DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              onSelect={() => {
                                setState((st) => ({
                                  ...st,
                                  followUps: [{
                                    id: uid("f"), company: l.company, contactPerson: l.contactPerson, country: l.country,
                                    phone: l.phone, whatsapp: l.whatsapp, channel: "WhatsApp", lastContact: null,
                                    nextDate: todayIso(), nextTime: "10:00", status: "Pending", priority: l.priority,
                                    tags: [], assignedTo: l.assignedTo, notes: "", completed: false, relatedId: l.id,
                                  }, ...st.followUps],
                                }));
                                toast.success("Follow-up created");
                              }}
                            >
                              Add Follow-Up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setState((st) => ({
                                  ...st,
                                  tasks: [{
                                    id: uid("t"), title: `Work on lead ${l.id}`, description: "", relatedTo: l.company,
                                    assignedTo: l.assignedTo, startDate: todayIso(), dueDate: todayIso(), dueTime: "10:00",
                                    priority: l.priority, status: "To Do", goalCategory: "Leads", reminder: true, notes: "",
                                  }, ...st.tasks],
                                }));
                                toast.success("Task created");
                              }}
                            >
                              Create Task
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setState((st) => ({
                                  ...st,
                                  quotations: [{
                                    id: uid("q"), number: `LEPDO-Q-${new Date().getFullYear()}-${String(st.quotations.length + 1).padStart(5, "0")}`,
                                    type: "Diamond" as const, date: todayIso(),
                                    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
                                    company: l.company, contactPerson: l.contactPerson, billingAddress: "", country: l.country,
                                    email: l.email, phone: l.phone, whatsapp: l.whatsapp, assignedTo: l.assignedTo,
                                    createdBy: st.currentUserId, createdAt: todayIso(), updatedAt: todayIso(), revision: 1,
                                    currency: "USD", paymentTerms: "50% advance", deliveryTerms: "7 working days",
                                    notes: "", terms: st.settings.quotationTerms,
                                    diamondItems: [{
                                      id: uid("i"), sku: "", category: l.requirement.productType, image: null,
                                      description: [l.requirement.productType, l.requirement.shape, l.requirement.colour, l.requirement.clarity, l.requirement.certification].filter(Boolean).join(" · "),
                                      link: "", pieces: null, carats: null, pricePerCt: null,
                                    }],
                                    jewelryItems: [],
                                    discount: 0, shipping: 0, status: "Draft" as const, invoice: null, leadId: l.id,
                                  }, ...st.quotations],

                                }));
                                toast.success("Draft quotation created");
                                void navigate({ to: "/quotations" });
                              }}
                            >
                              Create Quotation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="p-4"><EmptyState title="No leads found" description="Add a lead or clear the filters." /></div>}
            <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-3">
          <div className="pb-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {STAGES.map((stage) => {
                const items = filtered.filter((l) => l.stage === stage);
                return (
                  <div key={stage} className="min-w-0 rounded-xl bg-muted/50 p-2">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-xs font-semibold">{stage}</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((l) => (
                        <div key={l.id} className="card-soft space-y-1.5 p-2.5">
                          <div className="truncate text-sm font-medium">{l.company}</div>
                          <div className="truncate text-xs text-muted-foreground">{l.country} · {money(l.value)}</div>
                          <div className="truncate text-[11px] text-muted-foreground">Added by {sellerName(l.createdBy ?? "")}</div>
                          <div className="flex items-center justify-between gap-1">
                            <StatusPill value={l.priority} />
                            <select
                              className="h-7 max-w-28 rounded-md border bg-background px-1 text-[11px]"
                              value={l.stage}
                              onChange={(e) => setStage(l, e.target.value as LeadStage)}
                              aria-label={`Change stage for ${l.company}`}
                            >
                              {STAGES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">Empty</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Lead ${editing.id}` : "Add lead"}</DialogTitle>
            <DialogDescription>Save the customer details and their exact requirement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Company *</Label><Input className="h-9" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Contact person</Label><Input className="h-9" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Country</Label><Input className="h-9" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input className="h-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input className="h-9" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input className="h-9" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Source</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {state.settings.sources.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Priority</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Lead["priority"] })}>
                {["Low", "Medium", "High", "Urgent"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Lead value (USD)</Label><Input type="number" className="h-9" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label className="text-xs">Stage</Label>
              <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Next follow-up</Label><Input type="date" className="h-9" value={form.nextFollowUp ?? ""} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value || null })} /></div>
            {admin && (
              <div className="space-y-1"><Label className="text-xs">Assigned seller</Label>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                  {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
            )}
          </div>

          <h3 className="mt-2 text-sm font-semibold">Requirement</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["productType", "Product type"], ["shape", "Shape"], ["caratRange", "Carat range"],
              ["colour", "Colour"], ["clarity", "Clarity"], ["cut", "Cut"],
              ["certification", "Certification"], ["quantity", "Quantity"], ["targetPrice", "Target price"],
              ["metalType", "Metal type"], ["jewelryType", "Jewelry type"], ["deadline", "Delivery deadline"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input className="h-9" value={form.requirement[key]} onChange={(e) => setForm({ ...form, requirement: { ...form.requirement, [key]: e.target.value } })} />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Special instructions</Label>
              <Textarea rows={2} value={form.requirement.instructions} onChange={(e) => setForm({ ...form, requirement: { ...form.requirement, instructions: e.target.value } })} /></div>
            <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {editing && (
              <>
                <Button variant="outline" onClick={() => { setStage(editing, "Won"); setOpen(false); }}>Mark Won</Button>
                <Button variant="outline" onClick={() => { setOpen(false); setLossFor(editing); }}>Mark Lost</Button>
              </>
            )}
            <Button onClick={save}>{editing ? "Save changes" : "Create lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lossFor} onOpenChange={(v) => !v && setLossFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Why was this lead lost?</DialogTitle>
            <DialogDescription>A reason helps improve future reports.</DialogDescription>
          </DialogHeader>
          <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {["Price too high", "No response", "Bought elsewhere", "Quality mismatch", "Delivery time", "Other"].map((r) => <option key={r}>{r}</option>)}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossFor(null)}>Cancel</Button>
            <Button
              disabled={!lossReason}
              onClick={() => {
                const lead = lossFor!;
                setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === lead.id ? { ...l, stage: "Lost", lossReason } : l)) }));
                logActivity({ action: "Lead marked lost", module: "Leads", record: lead.id, to: lossReason });
                toast.success("Lead marked as lost");
                setLossFor(null);
                setLossReason("");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
