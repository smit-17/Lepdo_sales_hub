export type Role = "super_admin" | "seller";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  department: string;
  monthlyGoal: number;
  active: boolean;
  demo?: boolean;
}

export type DataStatus =
  | "New"
  | "Contacted"
  | "Follow-Up Required"
  | "Converted to Lead"
  | "Invalid";

export interface DataRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  company: string;
  contactPerson: string;
  country: string;
  city: string;
  address?: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  source: string;
  productInterest: string;
  category: string;
  assignedTo: string;
  createdBy: string;
  status: DataStatus;
  tags: string[];
  nextFollowUp: string | null;
  notes: string;
  archived?: boolean;
  demo?: boolean;
}

export type FollowUpStatus =
  | "Pending"
  | "Contacted"
  | "No Response"
  | "Interested"
  | "Requirement Received"
  | "Quotation Sent"
  | "Negotiation"
  | "Follow-Up Later"
  | "Converted"
  | "Not Interested"
  | "Invalid";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export interface FollowUp {
  id: string;
  company: string;
  contactPerson: string;
  country: string;
  phone: string;
  whatsapp: string;
  channel: "WhatsApp" | "Call" | "Email";
  lastContact: string | null;
  nextDate: string;
  nextTime: string;
  status: FollowUpStatus;
  priority: Priority;
  tags: string[];
  assignedTo: string;
  notes: string;
  completed: boolean;
  relatedId?: string;
  /** Linked prospect data record id. */
  dataId?: string | undefined;
  /** Linked lead id. */
  leadId?: string | undefined;
  /** Outcome recorded when the follow-up was completed. */
  outcome?: string | undefined;
  archived?: boolean;
  demo?: boolean;
}

export type LeadStage =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Requirement Received"
  | "Quotation Sent"
  | "Negotiation"
  | "Won"
  | "Lost";

export interface Lead {
  id: string;
  createdAt: string;
  company: string;
  contactPerson: string;
  country: string;
  phone: string;
  whatsapp: string;
  email: string;
  source: string;
  assignedTo: string;
  priority: Priority;
  value: number;
  stage: LeadStage;
  /** User who added the lead (owner). */
  createdBy?: string | undefined;
  nextFollowUp: string | null;
  notes: string;
  lossReason?: string | undefined;
  /** Linked prospect data record id. */
  dataId?: string | undefined;
  requirement: {
    productType: string;
    shape: string;
    caratRange: string;
    colour: string;
    clarity: string;
    cut: string;
    certification: string;
    quantity: string;
    targetPrice: string;
    metalType: string;
    jewelryType: string;
    deadline: string;
    instructions: string;
  };
  archived?: boolean;
  demo?: boolean;
}

export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Accepted"
  | "Rejected"
  | "Expired";

/** Legacy simple item kept so older saved quotations still open. */
export interface QuotationItem {
  id: string;
  description: string;
  shape: string;
  carat: string;
  colour: string;
  clarity: string;
  certificate: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
}

export type QuotationType = "Diamond" | "Jewelry";

export interface ProductBase {
  id: string;
  sku: string;
  category: string;
  image: string | null;
  description: string;
  link: string;
}

export interface DiamondRow extends ProductBase {
  pieces: number | null;
  carats: number | null;
  pricePerCt: number | null;
}

export interface JewelryDiamondRow {
  id: string;
  description: string;
  pieces: number | null;
  carats: number | null;
  pricePerCt: number | null;
}

export interface JewelryItem extends ProductBase {
  metalType: string;
  karat: string;
  metalColour: string;
  grossWeight: number | null;
  netWeight: number | null;
  metalRate: number | null;
  makingPerGram: number | null;
  diamonds: JewelryDiamondRow[];
}

export type InvoiceStatus =
  | "Unpaid"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export interface Invoice {
  number: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;
  amountPaid?: number;
}

export interface Quotation {
  id: string;
  number: string;
  type: QuotationType;
  date: string;
  validUntil: string;
  company: string;
  contactPerson: string;
  billingAddress: string;
  country: string;
  email: string;
  phone: string;
  whatsapp: string;
  assignedTo: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  terms: string;
  /** Company snapshot used when the quotation was saved. */
  companySnapshot?: Settings["company"];
  items?: QuotationItem[];
  diamondItems: DiamondRow[];
  jewelryItems: JewelryItem[];
  discount: number;
  shipping: number;
  /** Optional absolute tax amount. */
  tax?: number;
  /** Optional absolute other charges. */
  otherCharges?: number;
  status: QuotationStatus;
  invoice?: Invoice | null;
  /** Linked customer record and lead — one selection fills both. */
  dataId?: string | undefined;
  leadId?: string | undefined;
  archived?: boolean;
  demo?: boolean;
}


export type TaskStatus = "To Do" | "In Progress" | "Completed" | "Cancelled";

export interface Task {
  id: string;
  title: string;
  description: string;
  relatedTo: string;
  /** Linked prospect data record id, so the related customer never drifts. */
  relatedDataId?: string | undefined;
  assignedTo: string;
  startDate: string;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  status: TaskStatus;
  goalCategory: string;
  reminder: boolean;
  notes: string;
  archived?: boolean;
  demo?: boolean;
}

export interface Activity {
  id: string;
  at: string;
  userId: string;
  action: string;
  module: string;
  record: string;
  from?: string | undefined;
  to?: string | undefined;
}

export interface Settings {
  tags: string[];
  sources: string[];
  categories: string[];
  countries: string[];
  currencies: string[];
  templates: { id: string; name: string; body: string }[];
  quotationTerms: string;
  invoiceTerms: string;
  company: { name: string; address: string; email: string; phone: string; website: string; logo?: string | null };
  /** Demo mode allows switching between the sample users from the header. */
  demoMode?: boolean;
}

export interface CrmState {
  users: User[];
  currentUserId: string;
  data: DataRecord[];
  followUps: FollowUp[];
  leads: Lead[];
  quotations: Quotation[];
  tasks: Task[];
  orders: Order[];
  targets: Target[];
  timeline: TimelineEntry[];
  activity: Activity[];
  settings: Settings;
}

/** Chronological client activity (the Client Profile timeline). */
export interface TimelineEntry {
  id: string;
  clientId: string;
  leadId?: string | undefined;
  quotationId?: string | undefined;
  orderId?: string | undefined;
  type: string;
  date: string;
  time: string;
  notes: string;
  nextFollowUp: string | null;
  assignedTo: string;
  createdBy: string;
  auto?: boolean;
}

export type OrderStatus =
  | "Order Done"
  | "Processing"
  | "Ready"
  | "Shipped"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export type PaymentStatus = "Pending" | "Partial" | "Paid";

export interface Order {
  id: string;
  orderNo: string;
  clientId: string;
  quotationId?: string | undefined;
  leadId?: string | undefined;
  orderDate: string;
  amount: number;
  currency: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  products: { description: string; quantity: number; total: number }[];
  tracking: string;
  notes: string;
  assignedTo: string;
  createdBy: string;
  archived?: boolean;
  demo?: boolean;
}

export type TargetPeriod = "Monthly" | "Quarterly" | "Yearly" | "Custom";

export interface Target {
  id: string;
  name: string;
  period: TargetPeriod;
  startDate: string;
  endDate: string;
  currency: string;
  amount: number;
  assignedTo: string | null;
  companyWide: boolean;
  archived?: boolean;
  demo?: boolean;
}
