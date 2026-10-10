import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard, StatusPill, EmptyState, Pager, SearchInput, TableSkeleton } from "@/components/crm/ui-bits";
import { QuotationForm } from "@/components/crm/QuotationForm";
import { QuotationDocument, printWithRetry } from "@/components/crm/QuotationDocument";
import { useCrm, useCurrentUser, useHydrated, setState, uid, logActivity } from "@/lib/store";
import { amount, dateLabel, money, quotationTotals, todayIso } from "@/lib/format";
import {
  blankQuotation, nextInvoiceNumber, nextQuotationNumber, normalizeQuotation,
} from "@/lib/quotation-helpers";
import type { Quotation, QuotationStatus, InvoiceStatus } from "@/lib/types";
import { useQuickAdd } from "@/lib/use-quick-add";
import { markOrderDone } from "@/lib/workflow";

import { useDebounced } from "@/lib/use-debounced";

export const Route = createFileRoute("/_authenticated/quotations")({
  validateSearch: (s: Record<string, unknown>): { status?: string } => ({
    ...(typeof s['status'] === "string" ? { status: s['status'] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Quotations & Invoices — LEPDO Sales CRM" },
      { name: "description", content: "Create branded diamond and jewelry quotations, calculate totals and convert accepted quotes into invoices." },
      { property: "og:title", content: "Quotations & Invoices — LEPDO Sales CRM" },
      { property: "og:description", content: "Professional LEPDO quotations with PDF download and invoice conversion." },
    ],
  }),
  component: QuotationsPage,
});

const STATUSES: QuotationStatus[] = ["Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired"];
const TONES = ["lavender", "blue", "mint", "peach", "rose", "yellow"] as const;

function QuotationsPage() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const hydrated = useHydrated();
  const admin = user.role === "super_admin";

  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const sp = Route.useSearch();
  const [statusFilter, setStatusFilter] = useState(sp.status ?? "");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editor, setEditor] = useState<Quotation | null>(null);
  const [preview, setPreview] = useState<{ q: Quotation; mode: "quotation" | "invoice" } | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<Quotation | null>(null);
  const [orderFor, setOrderFor] = useState<Quotation | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function confirmOrder(quote: Quotation) {
    if (confirming) return;
    setConfirming(true);
    try {
      const { order, created } = await markOrderDone(quote, quotationTotals(quote).total);
      toast.success(
        created ? `Order ${order.orderNo} created` : `Order ${order.orderNo} already exists`,
      );
      setOrderFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not confirm the order");
    } finally {
      setConfirming(false);
    }
  }


  useQuickAdd("quotation", () => setEditor(blankQuotation(state, user.id)));

  const visible = useMemo(
    () => state.quotations
      .filter((x) => !x.archived && (admin || x.assignedTo === user.id))
      .map(normalizeQuotation),
    [state.quotations, admin, user.id],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visible.filter((x) => {
      if (term && !`${x.number} ${x.company} ${x.country} ${x.invoice?.number ?? ""}`.toLowerCase().includes(term)) return false;
      if (statusFilter && x.status !== statusFilter) return false;
      if (typeFilter && x.type !== typeFilter) return false;
      return true;
    });
  }, [visible, q, statusFilter, typeFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const summary = [
    { label: "Total", value: visible.length, tone: "blue" as const },
    ...STATUSES.map((s, i) => ({
      label: s,
      value: visible.filter((x) => x.status === s).length,
      tone: TONES[i]!,
    })),
    { label: "Total Value", value: money(visible.reduce((a, x) => a + quotationTotals(x).total, 0)), tone: "mint" as const },
  ];

  async function save(quote: Quotation, finalize: boolean) {
    const isNew = !quote.id;
    const record: Quotation = {
      ...quote,
      id: quote.id || uid("q"),
      number: quote.number || nextQuotationNumber(state.quotations),
      createdBy: quote.createdBy ?? user.id,
      createdAt: quote.createdAt ?? todayIso(),
      updatedAt: todayIso(),
      revision: (quote.revision ?? 0) + 1,
      companySnapshot: state.settings.company,
      status: finalize && quote.status === "Draft" && !isNew ? quote.status : quote.status,
    };
    setState((s) => ({
      ...s,
      quotations: isNew
        ? [record, ...s.quotations]
        : s.quotations.map((x) => (x.id === record.id ? record : x)),
    }));
    logActivity({
      action: isNew ? "Quotation created" : "Quotation updated",
      module: "Quotations",
      record: record.number,
    });
    toast.success(finalize ? "Quotation saved — opening PDF" : "Draft saved");
    setEditor(null);
    if (finalize) {
      setPreview({ q: record, mode: "quotation" });
      await new Promise((r) => setTimeout(r, 400));
      await printWithRetry(record);
    }
  }

  function setStatus(quote: Quotation, status: QuotationStatus) {
    setState((s) => ({ ...s, quotations: s.quotations.map((x) => (x.id === quote.id ? { ...x, status, updatedAt: todayIso() } : x)) }));
    logActivity({ action: "Quotation status changed", module: "Quotations", record: quote.number, from: quote.status, to: status });
    toast.success(`Marked as ${status}`);
  }

  if (!hydrated) return <TableSkeleton rows={8} />;

  if (editor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditor(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to quotations
          </Button>
          <h1 className="truncate text-sm font-semibold">
            {editor.id ? `Edit ${editor.number}` : `New quotation ${editor.number}`}
          </h1>
        </div>
        <QuotationForm initial={editor} onCancel={() => setEditor(null)} onSave={save} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {summary.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setEditor(blankQuotation(state, user.id))}>
          <Plus className="mr-1.5 h-4 w-4" /> Create Quotation
        </Button>
        <SearchInput className="w-full sm:w-64" value={search} onChange={setSearch} placeholder="Search number, customer or invoice…" />
        <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} aria-label="Filter by type">
          <option value="">All types</option>
          <option>Diamond</option>
          <option>Jewelry</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={!search && !statusFilter && !typeFilter}
          onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); setPage(1); }}
        >
          Clear filters
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {visible.length} quotations
        </span>
      </div>

      <div className="card-soft">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[30%] p-2 font-medium">Quotation</th>
                <th className="w-[24%] p-2 font-medium">Customer</th>
                <th className="hidden w-[16%] p-2 font-medium lg:table-cell">Dates</th>
                <th className="w-[18%] p-2 font-medium">Total &amp; status</th>
                <th className="w-[12%] p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((x) => (
                <tr key={x.id} className="border-t align-top hover:bg-accent/30">
                  <td className="min-w-0 p-2">
                    <div className="truncate font-medium">{x.number}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {x.type} · {x.type === "Jewelry" ? x.jewelryItems.length : x.diamondItems.length} item(s)
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground lg:hidden">
                      {dateLabel(x.date)} → {dateLabel(x.validUntil)}
                    </div>
                  </td>
                  <td className="min-w-0 p-2">
                    <div className="truncate">{x.company || "Untitled customer"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[x.contactPerson, x.country].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="hidden min-w-0 p-2 text-xs lg:table-cell">
                    <div>{dateLabel(x.date)}</div>
                    <div className="text-muted-foreground">Valid to {dateLabel(x.validUntil)}</div>
                  </td>
                  <td className="min-w-0 space-y-1 p-2">
                    <div className="truncate font-semibold">{amount(quotationTotals(x).total, x.currency)}</div>
                    <StatusPill value={x.status} />
                    {x.invoice ? <div><StatusPill value={x.invoice.status} /></div> : null}
                  </td>
                  <td className="p-2 text-right"><RowActions x={x} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {paged.map((x) => (
            <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-3">
              <div className="min-w-0 space-y-1">
                <div className="truncate text-sm font-medium">{x.company || "Untitled customer"}</div>
                <div className="truncate text-xs text-muted-foreground">{x.number} · {x.type} · {dateLabel(x.date)}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill value={x.status} />
                  {x.invoice ? <StatusPill value={x.invoice.status} /> : null}
                  <span className="text-xs font-semibold">{amount(quotationTotals(x).total, x.currency)}</span>
                </div>
              </div>
              <RowActions x={x} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState
              title="No quotations yet"
              description="Create your first diamond or jewelry quotation to see it here."
              action={<Button size="sm" className="mt-1" onClick={() => setEditor(blankQuotation(state, user.id))}>Create Quotation</Button>}
            />
          </div>
        )}
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {preview && <DocumentPreview quote={preview.q} mode={preview.mode} onClose={() => setPreview(null)} />}
      {invoiceFor && (
        <InvoiceDialog
          quote={invoiceFor}
          suggested={nextInvoiceNumber(state.quotations)}
          onClose={() => setInvoiceFor(null)}
          onDone={(quote) => { setInvoiceFor(null); setPreview({ q: quote, mode: "invoice" }); }}
        />
      )}
      <Dialog open={!!orderFor} onOpenChange={(v) => !v && setOrderFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm order</DialogTitle>
            <DialogDescription>
              {orderFor
                ? `This creates one order for ${orderFor.company} worth ${money(
                    quotationTotals(orderFor).total,
                    orderFor.currency,
                  )}, marks the lead as Won and records it on the client timeline.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={confirming}
              onClick={() => orderFor && void confirmOrder(orderFor)}
            >
              {confirming ? "Confirming…" : "Order Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );

  function RowActions({ x }: { x: Quotation }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7">Actions</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setPreview({ q: x, mode: "quotation" })}>Preview / Download PDF</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditor(x)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setState((s) => ({
                ...s,
                quotations: [{
                  ...x, id: uid("q"), number: nextQuotationNumber(s.quotations), status: "Draft",
                  invoice: null, revision: 1, createdAt: todayIso(), updatedAt: todayIso(),
                }, ...s.quotations],
              }));
              toast.success("Quotation duplicated");
            }}
          >
            Duplicate
          </DropdownMenuItem>
          {STATUSES.filter((s) => s !== x.status).map((s) => (
            <DropdownMenuItem key={s} onSelect={() => setStatus(x, s)}>Mark as {s}</DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => setOrderFor(x)}>Order Done</DropdownMenuItem>

          {x.status === "Accepted" && !x.invoice && (
            <DropdownMenuItem onSelect={() => setInvoiceFor(x)}>Convert to Invoice</DropdownMenuItem>
          )}
          {x.invoice && (
            <DropdownMenuItem onSelect={() => setPreview({ q: x, mode: "invoice" })}>View Invoice PDF</DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setState((s) => ({ ...s, quotations: s.quotations.map((r) => (r.id === x.id ? { ...r, archived: true } : r)) }));
              toast.success(`${x.number} archived`, {
                action: {
                  label: "Undo",
                  onClick: () => setState((s) => ({ ...s, quotations: s.quotations.map((r) => (r.id === x.id ? { ...r, archived: false } : r)) })),
                },
                duration: 10000,
              });
            }}
          >
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}

function InvoiceDialog({
  quote, suggested, onClose, onDone,
}: { quote: Quotation; suggested: string; onClose: () => void; onDone: (q: Quotation) => void }) {
  const [invoice, setInvoice] = useState({
    number: suggested,
    date: todayIso(),
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    status: "Unpaid" as InvoiceStatus,
    notes: "",
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert {quote.number} to invoice</DialogTitle>
          <DialogDescription>Customer and product details are carried over automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label className="text-xs">Invoice number</Label><Input className="h-9" value={invoice.number} onChange={(e) => setInvoice({ ...invoice, number: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Invoice date</Label><Input type="date" className="h-9" value={invoice.date} onChange={(e) => setInvoice({ ...invoice, date: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Due date</Label><Input type="date" className="h-9" value={invoice.dueDate} onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Payment status</Label>
            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={invoice.status} onChange={(e) => setInvoice({ ...invoice, status: e.target.value as InvoiceStatus })}>
              {["Unpaid", "Partially Paid", "Paid", "Overdue", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea rows={2} value={invoice.notes} onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const updated = { ...quote, invoice, updatedAt: todayIso() };
              setState((s) => ({ ...s, quotations: s.quotations.map((x) => (x.id === quote.id ? updated : x)) }));
              logActivity({ action: "Quotation converted to invoice", module: "Quotations", record: quote.number, to: invoice.number });
              toast.success("Invoice created");
              onDone(updated);
            }}
          >
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentPreview({
  quote, mode, onClose,
}: { quote: Quotation; mode: "quotation" | "invoice"; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="no-print">
          <DialogTitle>
            {mode === "invoice" && quote.invoice ? `Invoice ${quote.invoice.number}` : `Quotation ${quote.number}`}
          </DialogTitle>
          <DialogDescription>Choose “Save as PDF” in the print dialog to download an A4 copy.</DialogDescription>
        </DialogHeader>

        <div className="scroll-x rounded-xl border">
          <QuotationDocument quote={quote} mode={mode} />
        </div>

        <DialogFooter className="no-print flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            disabled={busy}
            onClick={async () => { setBusy(true); await printWithRetry(quote); setBusy(false); }}
          >
            <Printer className="mr-1.5 h-4 w-4" /> {busy ? "Preparing…" : "Download PDF / Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
