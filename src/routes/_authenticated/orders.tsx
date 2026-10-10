import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Package, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  Pager,
  SearchInput,
  StatCard,
  StatusPill,
  TableSkeleton,
} from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, scope, logActivity } from "@/lib/store";
import { amount, dateLabel } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";
import { addTimelineEntry } from "@/lib/workflow";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { exportCsv } from "@/lib/io";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders · LEPDO Sales CRM" },
      {
        name: "description",
        content:
          "Confirmed LEPDO orders with amounts, currencies, order status, payment status and linked quotations.",
      },
      { property: "og:title", content: "Orders · LEPDO Sales CRM" },
      {
        property: "og:description",
        content: "Track confirmed orders, delivery progress and payments in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search['status'] === "string" ? { status: search['status'] as string } : {}),
    ...(typeof search['month'] === "string" ? { month: search['month'] as string } : {}),
  }),
  component: OrdersPage,
});

const ORDER_STATUSES: OrderStatus[] = [
  "Order Done",
  "Processing",
  "Ready",
  "Shipped",
  "Delivered",
  "Completed",
  "Cancelled",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Partial", "Paid"];

function OrdersPage() {
  const search = Route.useSearch();
  const ready = useHydrated();
  const me = useCurrentUser();
  const state = useCrm((s) => s);
  const orders = useMemo(
    () => scope(state.orders.filter((o) => !o.archived), state),
    [state],
  );
  const clientOf = (id: string) => state.data.find((d) => d.id === id);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const [status, setStatus] = useState(search.status ?? "all");
  const [payment, setPayment] = useState("all");
  const [country, setCountry] = useState("all");
  const [month, setMonth] = useState(search.month ?? "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openId, setOpenId] = useState<string | null>(null);

  const activeFilters = [status, payment, country, month].filter((v) => v !== "all").length;

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return orders.filter((o) => {
      const c = clientOf(o.clientId);
      if (status !== "all" && o.orderStatus !== status) return false;
      if (payment !== "all" && o.paymentStatus !== payment) return false;
      if (country !== "all" && c?.country !== country) return false;
      if (month !== "all" && !o.orderDate.startsWith(month)) return false;
      if (!q) return true;
      return [o.orderNo, c?.company, c?.contactPerson, c?.country, o.currency]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, debounced, status, payment, country, month, state.data]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const open = openId ? orders.find((o) => o.id === openId) ?? null : null;

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((o) => o.orderStatus !== "Cancelled")
      .forEach((o) => map.set(o.currency, (map.get(o.currency) ?? 0) + o.amount));
    return [...map.entries()];
  }, [filtered]);

  const received = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((o) => map.set(o.currency, (map.get(o.currency) ?? 0) + o.amountPaid));
    return [...map.entries()];
  }, [filtered]);

  const months = useMemo(
    () => [...new Set(orders.map((o) => o.orderDate.slice(0, 7)))].sort().reverse(),
    [orders],
  );
  const countries = useMemo(
    () => [...new Set(orders.map((o) => clientOf(o.clientId)?.country).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, state.data],
  );

  function update(order: Order, patch: Partial<Order>) {
    const next = { ...order, ...patch };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === order.id ? next : o)),
    }));
    if (patch.orderStatus && patch.orderStatus !== order.orderStatus) {
      logActivity({
        action: "Order status changed",
        module: "Orders",
        record: order.orderNo,
        from: order.orderStatus,
        to: patch.orderStatus,
      });
      addTimelineEntry({
        clientId: order.clientId,
        orderId: order.id,
        type: patch.orderStatus === "Cancelled" ? "Order Cancelled" : "Custom Activity",
        notes: `Order ${order.orderNo} marked ${patch.orderStatus}`,
        assignedTo: order.assignedTo || me.id,
      });
    }
    if (patch.paymentStatus && patch.paymentStatus !== order.paymentStatus) {
      logActivity({
        action: "Payment status changed",
        module: "Orders",
        record: order.orderNo,
        from: order.paymentStatus,
        to: patch.paymentStatus,
      });
      if (patch.paymentStatus === "Paid") {
        addTimelineEntry({
          clientId: order.clientId,
          orderId: order.id,
          type: "Payment Received",
          notes: `Full payment received for ${order.orderNo}`,
          assignedTo: order.assignedTo || me.id,
        });
      }
    }
    toast.success("Order updated");
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Orders" value={filtered.length} icon={<Package className="h-3.5 w-3.5" />} />
        <StatCard
          label="Order value"
          value={totalsByCurrency.length ? totalsByCurrency.map(([c, v]) => amount(v, c)).join(" · ") : "—"}
          hint={totalsByCurrency.length > 1 ? "Shown per currency" : undefined}
          tone="mint"
        />
        <StatCard
          label="Payments received"
          value={received.length ? received.map(([c, v]) => amount(v, c)).join(" · ") : "—"}
          tone="blue"
          icon={<CreditCard className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Awaiting payment"
          value={filtered.filter((o) => o.paymentStatus !== "Paid").length}
          tone="peach"
        />
      </div>

      <div className="card-soft min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search order no, client, country…"
            className="min-w-[12rem] flex-1"
          />
          <FilterSelect label="Order status" value={status} onChange={setStatus} options={ORDER_STATUSES} />
          <FilterSelect label="Payment" value={payment} onChange={setPayment} options={PAYMENT_STATUSES} />
          <FilterSelect label="Country" value={country} onChange={setCountry} options={countries as string[]} />
          <FilterSelect label="Month" value={month} onChange={setMonth} options={months} />
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} of {orders.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={!activeFilters}
            onClick={() => {
              setStatus("all");
              setPayment("all");
              setCountry("all");
              setMonth("all");
            }}
          >
            Clear filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() =>
              exportCsv(
                filtered.map((o) => ({
                  "Order No": o.orderNo,
                  Company: clientOf(o.clientId)?.company ?? "",
                  Country: clientOf(o.clientId)?.country ?? "",
                  "Quotation No": state.quotations.find((q) => q.id === o.quotationId)?.number ?? "",
                  "Order Date": o.orderDate,
                  Amount: o.amount,
                  Currency: o.currency,
                  "Order Status": o.orderStatus,
                  "Payment Status": o.paymentStatus,
                  "Assigned To": state.users.find((u) => u.id === o.assignedTo)?.name ?? "",
                })),
                "lepdo-orders",
              )
            }
          >
            Export
          </Button>
        </div>

        {!ready ? (
          <div className="p-3">
            <TableSkeleton />
          </div>
        ) : !filtered.length ? (
          <div className="p-3">
            <EmptyState
              title="No orders yet"
              description="Orders are created automatically when a quotation is marked Order Done."
            />
          </div>
        ) : (
          <>
            {/* mobile cards */}
            <ul className="divide-y md:hidden">
              {pageRows.map((o) => {
                const c = clientOf(o.clientId);
                return (
                  <li key={o.id} className="min-w-0 p-3">
                    <button
                      className="block w-full text-left"
                      onClick={() => setOpenId(o.id)}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c?.company || "—"}</span>
                        <span className="shrink-0 text-xs font-semibold">
                          {amount(o.amount, o.currency)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {o.orderNo} · {c?.country || "—"} · {dateLabel(o.orderDate)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <StatusPill value={o.orderStatus} />
                        <StatusPill value={o.paymentStatus} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* desktop table */}
            <div className="hidden md:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[14%] px-3 py-2 font-medium">Order</th>
                    <th className="w-[24%] px-3 py-2 font-medium">Client</th>
                    <th className="w-[14%] px-3 py-2 font-medium">Date</th>
                    <th className="w-[14%] px-3 py-2 text-right font-medium">Amount</th>
                    <th className="w-[16%] px-3 py-2 font-medium">Order status</th>
                    <th className="w-[18%] px-3 py-2 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o) => {
                    const c = clientOf(o.clientId);
                    return (
                      <tr key={o.id} className="border-t align-top hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <button
                            className="truncate font-medium text-primary hover:underline"
                            onClick={() => setOpenId(o.id)}
                          >
                            {o.orderNo}
                          </button>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {state.quotations.find((q) => q.id === o.quotationId)?.number ?? "—"}
                          </div>
                        </td>
                        <td className="min-w-0 px-3 py-2">
                          <div className="truncate font-medium">{c?.company || "—"}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {c?.contactPerson} · {c?.country}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{dateLabel(o.orderDate)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {amount(o.amount, o.currency)}
                        </td>
                        <td className="px-3 py-2">
                          <RowSelect
                            value={o.orderStatus}
                            options={ORDER_STATUSES}
                            label="Order status"
                            onChange={(v) => update(o, { orderStatus: v as OrderStatus })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <RowSelect
                            value={o.paymentStatus}
                            options={PAYMENT_STATUSES}
                            label="Payment status"
                            onChange={(v) =>
                              update(o, {
                                paymentStatus: v as PaymentStatus,
                                ...(v === "Paid" ? { amountPaid: o.amount } : {}),
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {open ? <OrderDetails order={open} onUpdate={update} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[7.5rem] text-xs" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: all</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowSelect({
  value,
  options,
  label,
  onChange,
}: {
  value: string;
  options: string[];
  label: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OrderDetails({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (o: Order, patch: Partial<Order>) => void;
}) {
  const state = useCrm((s) => s);
  const client = state.data.find((d) => d.id === order.clientId);
  const quotation = state.quotations.find((q) => q.id === order.quotationId);
  const timeline = state.timeline.filter((t) => t.orderId === order.id);
  const [paid, setPaid] = useState(String(order.amountPaid));
  const [note, setNote] = useState(order.notes);
  const [tracking, setTracking] = useState(order.tracking);

  return (
    <>
      <SheetHeader className="px-0">
        <SheetTitle className="truncate">{order.orderNo}</SheetTitle>
        <SheetDescription className="truncate">
          {client?.company} · {dateLabel(order.orderDate)} · {amount(order.amount, order.currency)}
        </SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Info label="Client" value={client?.company} />
        <Info label="Contact" value={client?.contactPerson} />
        <Info label="Country" value={client?.country} />
        <Info label="Phone" value={client?.phone} />
        <Info label="Quotation" value={quotation?.number} />
        <Info label="Currency" value={order.currency} />
        <Info label="Order status" value={order.orderStatus} />
        <Info label="Payment status" value={order.paymentStatus} />
      </dl>

      {order.products.length ? (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-semibold">Products</h3>
          <ul className="space-y-1 text-xs">
            {order.products.map((p, i) => (
              <li key={i} className="flex justify-between gap-2 border-b pb-1">
                <span className="min-w-0 truncate">{p.description}</span>
                <span className="shrink-0">{amount(p.total, order.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="paid" className="text-xs">
            Amount received ({order.currency})
          </Label>
          <Input id="paid" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking" className="text-xs">
            Shipping / tracking
          </Label>
          <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note" className="text-xs">
            Notes
          </Label>
          <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const value = Math.max(0, Number(paid) || 0);
            onUpdate(order, {
              amountPaid: value,
              notes: note,
              tracking,
              paymentStatus: value <= 0 ? "Pending" : value >= order.amount ? "Paid" : "Partial",
            });
          }}
        >
          Save order
        </Button>
      </div>

      <div className="mt-4">
        <h3 className="mb-1 text-xs font-semibold">Order timeline</h3>
        {timeline.length ? (
          <ul className="space-y-1.5 text-xs">
            {timeline.map((t) => (
              <li key={t.id} className="border-l-2 pl-2">
                <span className="font-medium">{t.type}</span>
                <span className="ml-1 text-muted-foreground">{dateLabel(t.date)}</span>
                {t.notes ? <p className="text-muted-foreground">{t.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        )}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value || "—"}</dd>
    </div>
  );
}
