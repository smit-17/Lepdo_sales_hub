import { uid } from "./store";
import { todayIso } from "./format";
import type {
  CrmState,
  DiamondRow,
  JewelryDiamondRow,
  JewelryItem,
  Quotation,
  QuotationType,
} from "./types";

export const METAL_TYPES = ["Gold", "Silver", "Platinum"] as const;

export const KARAT_OPTIONS: Record<string, string[]> = {
  Gold: ["9K", "10K", "14K", "18K", "22K", "24K"],
  Silver: ["925 Sterling", "999 Fine"],
  Platinum: ["PT950", "PT900"],
};

export const METAL_COLOURS = ["Yellow", "White", "Rose", "Two Tone", "Natural"];

export const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function nextQuotationNumber(quotations: Quotation[]) {
  const year = new Date().getFullYear();
  const prefix = `LEPDO-Q-${year}-`;
  const used = quotations
    .filter((q) => q.number.startsWith(prefix))
    .map((q) => Number(q.number.slice(prefix.length)) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export function nextInvoiceNumber(quotations: Quotation[]) {
  const year = new Date().getFullYear();
  const prefix = `LEPDO-INV-${year}-`;
  const used = quotations
    .map((q) => q.invoice?.number ?? "")
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export function blankDiamondRow(): DiamondRow {
  return {
    id: uid("d"),
    sku: "",
    category: "",
    image: null,
    description: "",
    link: "",
    pieces: null,
    carats: null,
    pricePerCt: null,
  };
}

export function blankJewelryDiamond(): JewelryDiamondRow {
  return { id: uid("jd"), description: "", pieces: null, carats: null, pricePerCt: null };
}

export function blankJewelryItem(): JewelryItem {
  return {
    id: uid("j"),
    sku: "",
    category: "",
    image: null,
    description: "",
    link: "",
    metalType: "Gold",
    karat: "14K",
    metalColour: "Yellow",
    grossWeight: null,
    netWeight: null,
    metalRate: null,
    makingPerGram: null,
    diamonds: [blankJewelryDiamond()],
  };
}

export function blankQuotation(state: CrmState, userId: string): Quotation {
  return {
    id: "",
    number: nextQuotationNumber(state.quotations),
    type: "Diamond",
    date: todayIso(),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    company: "",
    contactPerson: "",
    billingAddress: "",
    country: "",
    email: "",
    phone: "",
    whatsapp: "",
    assignedTo: userId,
    createdBy: userId,
    createdAt: todayIso(),
    updatedAt: todayIso(),
    revision: 1,
    currency: state.settings.currencies[0] ?? "USD",
    paymentTerms: "50% advance, 50% before dispatch",
    deliveryTerms: "7 working days",
    notes: "",
    terms: state.settings.quotationTerms,
    companySnapshot: state.settings.company,
    diamondItems: [blankDiamondRow()],
    jewelryItems: [],
    discount: 0,
    shipping: 0,
    status: "Draft",
    invoice: null,
  };
}

/** Older saved quotations may not carry the new fields. */
export function normalizeQuotation(q: Quotation): Quotation {
  // Convert pre-rebuild rows into diamond rows so old records still open and total up.
  const legacy: DiamondRow[] = !q.type && q.items?.length
    ? q.items.map((it) => ({
        id: it.id,
        sku: "",
        category: "",
        image: null,
        description: [it.description, it.shape, it.colour, it.clarity, it.certificate].filter(Boolean).join(" · "),
        link: "",
        pieces: it.quantity,
        carats: Number(it.carat) * (it.quantity || 1) || null,
        pricePerCt: it.price,
      }))
    : [];
  return {
    ...q,
    type: (q.type ?? "Diamond") as QuotationType,
    diamondItems: q.diamondItems?.length ? q.diamondItems : legacy,
    jewelryItems: q.jewelryItems ?? [],
    discount: q.discount ?? 0,
    shipping: q.shipping ?? 0,
  };
}

export interface FieldErrors {
  [key: string]: string;
}

/** Draft saves only need a customer; finalising needs priced, complete rows. */
export function validateQuotation(q: Quotation, finalize: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!q.company.trim()) e["company"] = "Customer name is required.";
  if (!q.date) e["date"] = "Quotation date is required.";
  if (q.validUntil && q.date && q.validUntil < q.date)
    e["validUntil"] = "Valid-until cannot be earlier than the quotation date.";
  if (q.discount < 0) e["discount"] = "Discount cannot be negative.";
  if (q.shipping < 0) e["shipping"] = "Charges cannot be negative.";

  if (q.type === "Diamond") {
    q.diamondItems.forEach((r, i) => {
      const touched = r.sku || r.description || r.pieces != null || r.carats != null || r.pricePerCt != null;
      if (!touched) return;
      if (!r.description.trim()) e[`d.${r.id}.description`] = "Description is required.";
      if (finalize) {
        if (!r.pieces || r.pieces <= 0 || !Number.isInteger(r.pieces))
          e[`d.${r.id}.pieces`] = "Pcs must be a positive whole number.";
        if (!r.carats || r.carats <= 0) e[`d.${r.id}.carats`] = "Total carats is required.";
        if (r.pricePerCt == null || r.pricePerCt < 0) e[`d.${r.id}.pricePerCt`] = "Price per carat is required.";
      }
      if (i < 0) return;
    });
    if (finalize && !q.diamondItems.some((r) => r.description.trim())) e["items"] = "Add at least one product row.";
  } else {
    q.jewelryItems.forEach((it) => {
      if (!it.description.trim()) e[`j.${it.id}.description`] = "Description is required.";
      if ((it.netWeight ?? 0) > (it.grossWeight ?? 0) && it.grossWeight != null)
        e[`j.${it.id}.netWeight`] = "Net weight cannot exceed gross weight.";
      if ((it.grossWeight ?? 0) < 0 || (it.netWeight ?? 0) < 0) e[`j.${it.id}.netWeight`] = "Weights cannot be negative.";
      if (finalize) {
        if (!it.grossWeight) e[`j.${it.id}.grossWeight`] = "Gross weight is required.";
        if (!it.netWeight) e[`j.${it.id}.netWeight`] = "Net metal weight is required.";
        if (it.metalRate == null || it.metalRate < 0) e[`j.${it.id}.metalRate`] = "Metal rate is required.";
      }
      it.diamonds.forEach((d) => {
        const touched = d.description || d.pieces != null || d.carats != null || d.pricePerCt != null;
        if (!touched) return;
        if (finalize && (!d.carats || d.carats <= 0)) e[`jd.${d.id}.carats`] = "Carats required.";
        if (finalize && (d.pricePerCt == null || d.pricePerCt < 0)) e[`jd.${d.id}.pricePerCt`] = "Price required.";
        if (d.pieces != null && (d.pieces < 0 || !Number.isInteger(d.pieces)))
          e[`jd.${d.id}.pieces`] = "Whole number only.";
      });
    });
    if (finalize && !q.jewelryItems.length) e["items"] = "Add at least one jewelry product.";
  }
  return e;
}

export function pdfFileName(q: Quotation) {
  const clean = (v: string) => v.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
  return `Quotation_${clean(q.number)}_${clean(q.company) || "Customer"}.pdf`;
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      reject(new Error("Use a JPG, PNG or WEBP image."));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Image must be 1 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

export function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
