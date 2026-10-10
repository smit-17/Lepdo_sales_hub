/**
 * Cross-module workflow helpers.
 *
 * These keep the client record as the single source of truth: moving a client
 * into the pipeline, creating a quotation or confirming an order all reuse the
 * same client id and write the matching activity automatically.
 */
import { getState, setState, logActivity, uid } from "./store";
import { nextNumber } from "./cloud";
import { todayIso } from "./format";
import type { Lead, Order, Quotation, TimelineEntry } from "./types";

export const ACTIVITY_TYPES = [
  "Approached",
  "Follow-Up",
  "Follow-Up 2",
  "Follow-Up 3",
  "Replied",
  "No Reply",
  "Interested",
  "Not Interested",
  "Price Requested",
  "Quotation Created",
  "Quotation Shared",
  "Quotation Revised",
  "Negotiation",
  "Invoice Shared",
  "Payment Pending",
  "Payment Received",
  "Issue",
  "Complaint",
  "Order Done",
  "Order Cancelled",
  "Added to Leads",
  "Custom Activity",
] as const;

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

/** Adds one entry to a client's activity timeline. */
export function addTimelineEntry(entry: {
  clientId: string;
  type: string;
  notes?: string;
  date?: string;
  time?: string;
  nextFollowUp?: string | null;
  leadId?: string | undefined;
  quotationId?: string | undefined;
  orderId?: string | undefined;
  assignedTo?: string;
  auto?: boolean;
}) {
  const s = getState();
  const me = s.currentUserId;
  const row: TimelineEntry = {
    id: uid(),
    clientId: entry.clientId,
    type: entry.type,
    date: entry.date ?? todayIso(),
    time: entry.time ?? nowTime(),
    notes: entry.notes ?? "",
    nextFollowUp: entry.nextFollowUp ?? null,
    assignedTo: entry.assignedTo ?? me,
    createdBy: me,
    auto: entry.auto ?? true,
    ...(entry.leadId ? { leadId: entry.leadId } : {}),
    ...(entry.quotationId ? { quotationId: entry.quotationId } : {}),
    ...(entry.orderId ? { orderId: entry.orderId } : {}),
  };
  setState((st) => ({ ...st, timeline: [row, ...st.timeline] }));
  return row;
}

/** Attaches an existing client to the lead pipeline (never copies the client). */
export function moveToLead(clientId: string, stage: Lead["stage"] = "New") {
  const s = getState();
  const existing = s.leads.find((l) => l.dataId === clientId && !l.archived);
  if (existing) return existing;
  const client = s.data.find((d) => d.id === clientId);
  if (!client) return null;
  const lead: Lead = {
    id: uid(),
    createdAt: todayIso(),
    company: client.company,
    contactPerson: client.contactPerson,
    country: client.country,
    phone: client.phone,
    whatsapp: client.whatsapp,
    email: client.email,
    source: client.source,
    assignedTo: client.assignedTo || s.currentUserId,
    createdBy: s.currentUserId,
    priority: "Medium",
    value: 0,
    stage,
    nextFollowUp: null,
    notes: "",
    dataId: clientId,
    requirement: {
      productType: client.productInterest || "",
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
  };
  setState((st) => ({
    ...st,
    leads: [lead, ...st.leads],
    data: st.data.map((d) =>
      d.id === clientId ? { ...d, status: "Converted to Lead" as const } : d,
    ),
  }));
  logActivity({ action: "Moved to Leads", module: "Leads", record: client.company });
  addTimelineEntry({
    clientId,
    leadId: lead.id,
    type: "Added to Leads",
    notes: `${client.company} added to the lead pipeline`,
  });
  return lead;
}

/**
 * Confirms an order from an accepted quotation. Runs once per quotation: the
 * order number comes from the database so two people cannot create the same
 * one, and an existing order is returned instead of a duplicate.
 */
export async function markOrderDone(quotation: Quotation, total: number) {
  const s = getState();
  const existing = s.orders.find((o) => o.quotationId === quotation.id && !o.archived);
  if (existing) return { order: existing, created: false };
  if (!quotation.dataId) throw new Error("Link this quotation to a client first");

  const orderNo = await nextNumber("order");
  const products = [
    ...quotation.diamondItems.map((d) => ({
      description: d.description || d.sku || "Diamond",
      quantity: d.pieces ?? 0,
      total: (d.carats ?? 0) * (d.pricePerCt ?? 0),
    })),
    ...quotation.jewelryItems.map((j) => ({
      description: j.description || j.sku || "Jewellery",
      quantity: 1,
      total: 0,
    })),
  ];

  const order: Order = {
    id: uid(),
    orderNo,
    clientId: quotation.dataId,
    quotationId: quotation.id,
    ...(quotation.leadId ? { leadId: quotation.leadId } : {}),
    orderDate: todayIso(),
    amount: total,
    currency: quotation.currency,
    orderStatus: "Order Done",
    paymentStatus: "Pending",
    amountPaid: 0,
    products,
    tracking: "",
    notes: "",
    assignedTo: quotation.assignedTo || s.currentUserId,
    createdBy: s.currentUserId,
  };

  setState((st) => ({
    ...st,
    orders: [order, ...st.orders],
    quotations: st.quotations.map((q) =>
      q.id === quotation.id ? { ...q, status: "Accepted" as const } : q,
    ),
    leads: st.leads.map((l) =>
      l.dataId === quotation.dataId ? { ...l, stage: "Won" as const, value: total } : l,
    ),
  }));

  logActivity({
    action: "Order confirmed",
    module: "Orders",
    record: `${orderNo} · ${quotation.company}`,
  });
  addTimelineEntry({
    clientId: quotation.dataId,
    quotationId: quotation.id,
    orderId: order.id,
    type: "Order Done",
    notes: `Order ${orderNo} confirmed from quotation ${quotation.number}`,
  });
  return { order, created: true };
}
