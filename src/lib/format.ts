import type { Quotation } from "./types";

export function money(value: number, currency = "USD", fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value || 0);
}

/** Currency amount with the 2-decimal precision used in quotations and PDFs. */
export function amount(value: number, currency = "USD") {
  return money(value, currency, 2);
}


export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(date?: string | null) {
  if (!date) return false;
  return date < todayIso();
}

export function isToday(date?: string | null) {
  return !!date && date === todayIso();
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Round to 2 decimals without floating point drift. */
export function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function diamondRowTotal(row: { carats: number | null; pricePerCt: number | null }) {
  return round2(n(row.carats) * n(row.pricePerCt));
}

export function jewelryItemTotals(item: Quotation["jewelryItems"][number]) {
  const metalTotal = round2(n(item.netWeight) * n(item.metalRate));
  const diamondCarats = round2(item.diamonds.reduce((a, d) => a + n(d.carats), 0));
  const diamondTotal = round2(item.diamonds.reduce((a, d) => a + diamondRowTotal(d), 0));
  const makingTotal = round2(n(item.netWeight) * n(item.makingPerGram));
  return {
    metalTotal,
    diamondCarats,
    diamondTotal,
    makingTotal,
    total: round2(metalTotal + diamondTotal + makingTotal),
  };
}

export function quotationTotals(q: Quotation) {
  const discount = n(q.discount);
  const shipping = n(q.shipping);

  // Legacy records saved before the Diamond / Jewelry rebuild.
  if (!q.type && q.items?.length) {
    let subtotal = 0;
    let disc = 0;
    let tax = 0;
    for (const item of q.items) {
      const line = n(item.quantity) * n(item.price);
      const lineDiscount = (line * n(item.discount)) / 100;
      const lineTax = ((line - lineDiscount) * n(item.tax)) / 100;
      subtotal += line;
      disc += lineDiscount;
      tax += lineTax;
    }
    const sub = round2(subtotal - disc + tax);
    return {
      subtotal: sub, discount: 0, shipping, total: round2(sub + shipping),
      totalPieces: 0, totalCarats: 0, metalTotal: 0, diamondTotal: 0, makingTotal: 0,
    };
  }

  if (q.type === "Jewelry") {
    let metalTotal = 0, diamondTotal = 0, makingTotal = 0, subtotal = 0, totalCarats = 0;
    for (const item of q.jewelryItems ?? []) {
      const t = jewelryItemTotals(item);
      metalTotal += t.metalTotal;
      diamondTotal += t.diamondTotal;
      makingTotal += t.makingTotal;
      totalCarats += t.diamondCarats;
      subtotal += t.total;
    }
    subtotal = round2(subtotal);
    return {
      subtotal,
      discount,
      shipping,
      total: round2(subtotal - discount + shipping),
      totalPieces: (q.jewelryItems ?? []).length,
      totalCarats: round2(totalCarats),
      metalTotal: round2(metalTotal),
      diamondTotal: round2(diamondTotal),
      makingTotal: round2(makingTotal),
    };
  }

  const rows = q.diamondItems ?? [];
  const subtotal = round2(rows.reduce((a, r) => a + diamondRowTotal(r), 0));
  return {
    subtotal,
    discount,
    shipping,
    total: round2(subtotal - discount + shipping),
    totalPieces: rows.reduce((a, r) => a + n(r.pieces), 0),
    totalCarats: round2(rows.reduce((a, r) => a + n(r.carats), 0)),
    metalTotal: 0,
    diamondTotal: subtotal,
    makingTotal: 0,
  };
}


export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
