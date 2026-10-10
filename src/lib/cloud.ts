/**
 * Cloud data layer.
 *
 * Every CRM record lives in the shared database. The app keeps the same
 * in-memory shape it always used, and this module maps rows both ways and
 * pushes only the rows that actually changed, so a screen never has to know
 * about the database.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  CrmState,
  DataRecord,
  FollowUp,
  Lead,
  Order,
  Quotation,
  Settings,
  Target,
  Task,
  TimelineEntry,
  User,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v?: string | null) => !!v && UUID.test(v);
const s = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const uuidOrNull = (v?: string | null) => (isUuid(v) ? v! : null);

type Row = Record<string, unknown>;

/* ------------------------------- mappers -------------------------------- */

const clientToRow = (d: DataRecord): Row => ({
  id: d.id,
  company: d.company,
  contact_person: d.contactPerson,
  phone: d.phone,
  whatsapp: d.whatsapp,
  email: d.email,
  website: d.website,
  country: d.country,
  city: d.city,
  address: d.address ?? "",
  source: d.source,
  category: d.category,
  product_interest: d.productInterest,
  status: d.status,
  tags: d.tags ?? [],
  notes: d.notes,
  assigned_to: uuidOrNull(d.assignedTo),
  created_by: uuidOrNull(d.createdBy),
  added_date: (d.createdAt || "").slice(0, 10) || undefined,
  archived: !!d.archived,
  demo: !!d.demo,
});

const rowToClient = (r: Row): DataRecord => ({
  id: s(r['id']),
  createdAt: s(r['added_date']) || s(r['created_at']).slice(0, 10),
  updatedAt: s(r['updated_at']).slice(0, 10),
  company: s(r['company']),
  contactPerson: s(r['contact_person']),
  country: s(r['country']),
  city: s(r['city']),
  address: s(r['address']),
  phone: s(r['phone']),
  whatsapp: s(r['whatsapp']),
  email: s(r['email']),
  website: s(r['website']),
  source: s(r['source']),
  productInterest: s(r['product_interest']),
  category: s(r['category']),
  assignedTo: s(r['assigned_to']),
  createdBy: s(r['created_by']),
  status: (s(r['status']) || "New") as DataRecord["status"],
  tags: Array.isArray(r['tags']) ? (r['tags'] as string[]) : [],
  nextFollowUp: null,
  notes: s(r['notes']),
  archived: !!r['archived'],
  demo: !!r['demo'],
});

const leadToRow = (l: Lead): Row => ({
  id: l.id,
  client_id: uuidOrNull(l.dataId),
  stage: l.stage,
  priority: l.priority,
  value: l.value,
  requirement: l.requirement,
  loss_reason: l.lossReason ?? "",
  notes: l.notes,
  assigned_to: uuidOrNull(l.assignedTo),
  created_by: uuidOrNull(l.createdBy),
  archived: !!l.archived,
  demo: !!l.demo,
});

const rowToLead = (r: Row, client?: DataRecord): Lead => ({
  id: s(r['id']),
  createdAt: s(r['created_at']).slice(0, 10),
  company: client?.company ?? "",
  contactPerson: client?.contactPerson ?? "",
  country: client?.country ?? "",
  phone: client?.phone ?? "",
  whatsapp: client?.whatsapp ?? "",
  email: client?.email ?? "",
  source: client?.source ?? "",
  assignedTo: s(r['assigned_to']),
  createdBy: s(r['created_by']) || undefined,
  priority: (s(r['priority']) || "Medium") as Lead["priority"],
  value: num(r['value']),
  stage: (s(r['stage']) || "New") as Lead["stage"],
  nextFollowUp: null,
  notes: s(r['notes']),
  lossReason: s(r['loss_reason']),
  dataId: s(r['client_id']),
  requirement: (r['requirement'] ?? {}) as Lead["requirement"],
  archived: !!r['archived'],
  demo: !!r['demo'],
});

const followUpToRow = (f: FollowUp): Row => ({
  id: f.id,
  client_id: uuidOrNull(f.dataId) ?? uuidOrNull(f.relatedId),
  lead_id: uuidOrNull(f.leadId),
  channel: f.channel,
  next_date: f.nextDate,
  next_time: f.nextTime,
  last_contact: f.lastContact || null,
  status: f.status,
  priority: f.priority,
  notes: f.notes,
  outcome: f.outcome ?? "",
  completed: !!f.completed,
  assigned_to: uuidOrNull(f.assignedTo),
  created_by: uuidOrNull(f.assignedTo),
  archived: !!f.archived,
  demo: !!f.demo,
});

const rowToFollowUp = (r: Row, client?: DataRecord): FollowUp => ({
  id: s(r['id']),
  company: client?.company ?? "",
  contactPerson: client?.contactPerson ?? "",
  country: client?.country ?? "",
  phone: client?.phone ?? "",
  whatsapp: client?.whatsapp ?? "",
  channel: (s(r['channel']) || "WhatsApp") as FollowUp["channel"],
  lastContact: s(r['last_contact']) || null,
  nextDate: s(r['next_date']),
  nextTime: s(r['next_time']),
  status: (s(r['status']) || "Pending") as FollowUp["status"],
  priority: (s(r['priority']) || "Medium") as FollowUp["priority"],
  tags: [],
  assignedTo: s(r['assigned_to']),
  notes: s(r['notes']),
  completed: !!r['completed'],
  dataId: s(r['client_id']),
  leadId: s(r['lead_id']) || undefined,
  outcome: s(r['outcome']),
  archived: !!r['archived'],
  demo: !!r['demo'],
});

const quotationToRow = (q: Quotation): Row => ({
  id: q.id,
  number: q.number,
  client_id: uuidOrNull(q.dataId),
  lead_id: uuidOrNull(q.leadId),
  quotation_type: q.type,
  quote_date: q.date,
  valid_until: q.validUntil || null,
  currency: q.currency,
  billing_address: q.billingAddress,
  payment_terms: q.paymentTerms,
  delivery_terms: q.deliveryTerms,
  notes: q.notes,
  terms: q.terms,
  diamond_items: q.diamondItems ?? [],
  jewelry_items: q.jewelryItems ?? [],
  discount: q.discount,
  shipping: q.shipping,
  tax: q.tax ?? 0,
  other_charges: q.otherCharges ?? 0,
  status: q.status,
  revision: q.revision ?? 1,
  company_snapshot: q.companySnapshot ?? {},
  client_snapshot: {
    company: q.company,
    contactPerson: q.contactPerson,
    country: q.country,
    email: q.email,
    phone: q.phone,
    whatsapp: q.whatsapp,
  },
  invoice: q.invoice ?? null,
  assigned_to: uuidOrNull(q.assignedTo),
  created_by: uuidOrNull(q.createdBy) ?? uuidOrNull(q.assignedTo),
  archived: !!q.archived,
  demo: !!q.demo,
});

const rowToQuotation = (r: Row, client?: DataRecord): Quotation => {
  const snap = (r['client_snapshot'] ?? {}) as Record<string, string>;
  return {
    id: s(r['id']),
    number: s(r['number']),
    type: (s(r['quotation_type']) || "Diamond") as Quotation["type"],
    date: s(r['quote_date']),
    validUntil: s(r['valid_until']),
    company: client?.company ?? s(snap['company']),
    contactPerson: client?.contactPerson ?? s(snap['contactPerson']),
    billingAddress: s(r['billing_address']),
    country: client?.country ?? s(snap['country']),
    email: client?.email ?? s(snap['email']),
    phone: client?.phone ?? s(snap['phone']),
    whatsapp: client?.whatsapp ?? s(snap['whatsapp']),
    assignedTo: s(r['assigned_to']),
    createdBy: s(r['created_by']),
    createdAt: s(r['created_at']),
    updatedAt: s(r['updated_at']),
    revision: num(r['revision']) || 1,
    currency: s(r['currency']) || "USD",
    paymentTerms: s(r['payment_terms']),
    deliveryTerms: s(r['delivery_terms']),
    notes: s(r['notes']),
    terms: s(r['terms']),
    ...(r['company_snapshot']
      ? { companySnapshot: r['company_snapshot'] as NonNullable<Quotation["companySnapshot"]> }
      : {}),
    diamondItems: (Array.isArray(r['diamond_items']) ? r['diamond_items'] : []) as Quotation["diamondItems"],
    jewelryItems: (Array.isArray(r['jewelry_items']) ? r['jewelry_items'] : []) as Quotation["jewelryItems"],
    discount: num(r['discount']),
    shipping: num(r['shipping']),
    tax: num(r['tax']),
    otherCharges: num(r['other_charges']),
    status: (s(r['status']) || "Draft") as Quotation["status"],
    invoice: (r['invoice'] ?? null) as NonNullable<Quotation["invoice"]> | null,
    dataId: s(r['client_id']),
    leadId: s(r['lead_id']) || undefined,
    archived: !!r['archived'],
    demo: !!r['demo'],
  };
};

const orderToRow = (o: Order): Row => ({
  id: o.id,
  order_no: o.orderNo,
  client_id: uuidOrNull(o.clientId),
  quotation_id: uuidOrNull(o.quotationId),
  lead_id: uuidOrNull(o.leadId),
  order_date: o.orderDate,
  amount: o.amount,
  currency: o.currency,
  order_status: o.orderStatus,
  payment_status: o.paymentStatus,
  amount_paid: o.amountPaid,
  products: o.products ?? [],
  tracking: o.tracking,
  notes: o.notes,
  assigned_to: uuidOrNull(o.assignedTo),
  created_by: uuidOrNull(o.createdBy) ?? uuidOrNull(o.assignedTo),
  archived: !!o.archived,
  demo: !!o.demo,
});

const rowToOrder = (r: Row): Order => ({
  id: s(r['id']),
  orderNo: s(r['order_no']),
  clientId: s(r['client_id']),
  quotationId: s(r['quotation_id']) || undefined,
  leadId: s(r['lead_id']) || undefined,
  orderDate: s(r['order_date']),
  amount: num(r['amount']),
  currency: s(r['currency']) || "USD",
  orderStatus: (s(r['order_status']) || "Order Done") as Order["orderStatus"],
  paymentStatus: (s(r['payment_status']) || "Pending") as Order["paymentStatus"],
  amountPaid: num(r['amount_paid']),
  products: (Array.isArray(r['products']) ? r['products'] : []) as Order["products"],
  tracking: s(r['tracking']),
  notes: s(r['notes']),
  assignedTo: s(r['assigned_to']),
  createdBy: s(r['created_by']),
  archived: !!r['archived'],
  demo: !!r['demo'],
});

const taskToRow = (t: Task): Row => ({
  id: t.id,
  title: t.title,
  description: t.description,
  client_id: uuidOrNull(t.relatedDataId),
  priority: t.priority,
  start_date: t.startDate || null,
  due_date: t.dueDate,
  due_time: t.dueTime,
  status: t.status === "To Do" ? "Pending" : t.status,
  goal_category: t.goalCategory,
  reminder: !!t.reminder,
  notes: t.notes,
  assigned_to: uuidOrNull(t.assignedTo),
  created_by: uuidOrNull(t.assignedTo),
  archived: !!t.archived,
  demo: !!t.demo,
});

const rowToTask = (r: Row, client?: DataRecord): Task => ({
  id: s(r['id']),
  title: s(r['title']),
  description: s(r['description']),
  relatedTo: client?.company ?? "",
  relatedDataId: s(r['client_id']) || undefined,
  assignedTo: s(r['assigned_to']),
  startDate: s(r['start_date']),
  dueDate: s(r['due_date']),
  dueTime: s(r['due_time']),
  priority: (s(r['priority']) || "Medium") as Task["priority"],
  status: (s(r['status']) === "Pending" ? "To Do" : s(r['status'])) as Task["status"],
  goalCategory: s(r['goal_category']),
  reminder: !!r['reminder'],
  notes: s(r['notes']),
  archived: !!r['archived'],
  demo: !!r['demo'],
});

const targetToRow = (t: Target): Row => ({
  id: t.id,
  name: t.name,
  period: t.period,
  start_date: t.startDate,
  end_date: t.endDate,
  currency: t.currency,
  amount: t.amount,
  assigned_to: uuidOrNull(t.assignedTo),
  company_wide: !!t.companyWide,
  archived: !!t.archived,
});

const rowToTarget = (r: Row): Target => ({
  id: s(r['id']),
  name: s(r['name']),
  period: (s(r['period']) || "Monthly") as Target["period"],
  startDate: s(r['start_date']),
  endDate: s(r['end_date']),
  currency: s(r['currency']) || "USD",
  amount: num(r['amount']),
  assignedTo: s(r['assigned_to']) || null,
  companyWide: !!r['company_wide'],
  archived: !!r['archived'],
});

const timelineToRow = (t: TimelineEntry): Row => ({
  id: t.id,
  client_id: uuidOrNull(t.clientId),
  lead_id: uuidOrNull(t.leadId),
  quotation_id: uuidOrNull(t.quotationId),
  order_id: uuidOrNull(t.orderId),
  activity_type: t.type,
  activity_date: t.date,
  activity_time: t.time,
  notes: t.notes,
  next_follow_up: t.nextFollowUp || null,
  assigned_to: uuidOrNull(t.assignedTo),
  created_by: uuidOrNull(t.createdBy) ?? uuidOrNull(t.assignedTo),
  auto_generated: !!t.auto,
});

const rowToTimeline = (r: Row): TimelineEntry => ({
  id: s(r['id']),
  clientId: s(r['client_id']),
  leadId: s(r['lead_id']) || undefined,
  quotationId: s(r['quotation_id']) || undefined,
  orderId: s(r['order_id']) || undefined,
  type: s(r['activity_type']),
  date: s(r['activity_date']),
  time: s(r['activity_time']),
  notes: s(r['notes']),
  nextFollowUp: s(r['next_follow_up']) || null,
  assignedTo: s(r['assigned_to']),
  createdBy: s(r['created_by']),
  auto: !!r['auto_generated'],
});

/* --------------------------------- load --------------------------------- */

export async function loadCloud(): Promise<Partial<CrmState> | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [profiles, roles, clients, leads, followUps, quotations, orders, tasks, targets, timeline, audit, settings] =
    await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("user_roles").select("*"),
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("follow_ups").select("*").order("next_date"),
      supabase.from("quotations").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("order_date", { ascending: false }),
      supabase.from("tasks").select("*").order("due_date"),
      supabase.from("targets").select("*").order("start_date", { ascending: false }),
      supabase.from("activities").select("*").order("activity_date", { ascending: false }).limit(500),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("app_settings").select("settings").eq("id", 1).maybeSingle(),
    ]);

  const roleOf = (id: string) =>
    (roles.data ?? []).some((r) => r.user_id === id && r.role === "super_admin")
      ? "super_admin"
      : "seller";

  const users: User[] = (profiles.data ?? []).map((p) => ({
    id: p.id,
    name: p.name || p.email,
    email: p.email,
    phone: p.phone,
    role: roleOf(p.id) as User["role"],
    department: p.department,
    monthlyGoal: num(p.monthly_goal),
    active: p.active,
  }));

  const data = (clients.data ?? []).map((r) => rowToClient(r as Row));
  const byId = new Map(data.map((d) => [d.id, d]));

  const activity: Activity[] = (audit.data ?? []).map((r) => ({
    id: r.id,
    at: s(r.created_at).slice(0, 16).replace("T", " "),
    userId: s(r.user_id),
    action: r.action,
    module: r.module,
    record: r.record,
    from: r.from_value ?? undefined,
    to: r.to_value ?? undefined,
  }));

  const stored = (settings.data?.settings ?? {}) as Partial<Settings>;

  return {
    users,
    currentUserId: auth.user.id,
    data,
    leads: (leads.data ?? []).map((r) => rowToLead(r as Row, byId.get(s((r as Row)['client_id'])))),
    followUps: (followUps.data ?? []).map((r) =>
      rowToFollowUp(r as Row, byId.get(s((r as Row)['client_id']))),
    ),
    quotations: (quotations.data ?? []).map((r) =>
      rowToQuotation(r as Row, byId.get(s((r as Row)['client_id']))),
    ),
    orders: (orders.data ?? []).map((r) => rowToOrder(r as Row)),
    tasks: (tasks.data ?? []).map((r) => rowToTask(r as Row, byId.get(s((r as Row)['client_id'])))),
    targets: (targets.data ?? []).map((r) => rowToTarget(r as Row)),
    timeline: (timeline.data ?? []).map((r) => rowToTimeline(r as Row)),
    activity,
    ...(Object.keys(stored).length ? { settings: stored as Settings } : {}),
  };
}

/* --------------------------------- push --------------------------------- */

type Spec = {
  table: string;
  key: keyof CrmState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: (v: any) => Row;
};

const SPECS: Spec[] = [
  { table: "clients", key: "data", map: clientToRow },
  { table: "leads", key: "leads", map: leadToRow },
  { table: "follow_ups", key: "followUps", map: followUpToRow },
  { table: "quotations", key: "quotations", map: quotationToRow },
  { table: "orders", key: "orders", map: orderToRow },
  { table: "tasks", key: "tasks", map: taskToRow },
  { table: "targets", key: "targets", map: targetToRow },
  { table: "activities", key: "timeline", map: timelineToRow },
];

const fingerprints = new Map<string, string>();

/** Remembers what the database already holds, so nothing is written twice. */
export function primeFingerprints(state: CrmState) {
  fingerprints.clear();
  for (const spec of SPECS) {
    for (const row of (state[spec.key] ?? []) as { id: string }[]) {
      if (isUuid(row.id)) fingerprints.set(`${spec.table}:${row.id}`, JSON.stringify(spec.map(row)));
    }
  }
}

let pending = false;
let queued: CrmState | null = null;

/** Writes only the records that changed since the last push. */
export function pushChanges(state: CrmState) {
  queued = state;
  if (pending) return;
  pending = true;
  setTimeout(() => {
    const snapshot = queued;
    pending = false;
    queued = null;
    if (snapshot) void flush(snapshot);
  }, 400);
}

async function flush(state: CrmState) {
  for (const spec of SPECS) {
    const rows: Row[] = [];
    for (const item of (state[spec.key] ?? []) as { id: string; demo?: boolean }[]) {
      if (!isUuid(item.id)) continue;
      const row = spec.map(item);
      const print = JSON.stringify(row);
      const cacheKey = `${spec.table}:${item.id}`;
      if (fingerprints.get(cacheKey) === print) continue;
      fingerprints.set(cacheKey, print);
      rows.push(row);
    }
    if (!rows.length) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(spec.table).upsert(rows);
    if (error) {
      for (const row of rows) fingerprints.delete(`${spec.table}:${String(row['id'])}`);
      console.error(`Could not save ${spec.table}:`, error.message);
    }
  }
}

/** Team member profile changes (Admin screen). */
export async function saveProfile(user: User) {
  if (!isUuid(user.id)) return;
  await supabase
    .from("profiles")
    .update({
      name: user.name,
      phone: user.phone,
      department: user.department,
      monthly_goal: user.monthlyGoal,
      active: user.active,
    })
    .eq("id", user.id);
}

export async function saveSettings(settings: Settings) {
  const { error } = await supabase.from("app_settings").update({ settings: settings as never }).eq("id", 1);
  if (error) throw error;
}

export async function writeAudit(entry: Omit<Activity, "id" | "at" | "userId">, userId: string) {
  if (!isUuid(userId)) return;
  await supabase.from("audit_log").insert({
    user_id: userId,
    action: entry.action,
    module: entry.module,
    record: entry.record,
    from_value: entry.from ?? null,
    to_value: entry.to ?? null,
  });
}

/** Concurrency-safe quotation / order numbers straight from the database. */
export async function nextNumber(kind: "quotation" | "order", prefix?: string) {
  const { data, error } = await supabase.rpc(
    "next_number",
    prefix ? { _key: kind, _prefix: prefix } : { _key: kind },
  );
  if (error || !data) throw error ?? new Error("Could not reserve a number");
  return data as string;
}
