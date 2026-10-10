import { toast } from "sonner";
import { amount, dateLabel, diamondRowTotal, jewelryItemTotals, quotationTotals } from "@/lib/format";
import { useCrm } from "@/lib/store";
import { pdfFileName } from "@/lib/quotation-helpers";
import type { Quotation } from "@/lib/types";
import lepdoaccountlogo from "@/assets/lepdoaccountlogo.png";

export const DOC_ID = "lepdo-doc";

export function QuotationDocument({
  quote, mode = "quotation",
}: { quote: Quotation; mode?: "quotation" | "invoice" }) {
  const settings = useCrm((s) => s.settings);
  const seller = useCrm((s) => s.users.find((u) => u.id === quote.assignedTo));
  const company = quote.companySnapshot ?? settings.company;
  const totals = quotationTotals(quote);
  const cur = quote.currency;
  const isInvoice = mode === "invoice" && !!quote.invoice;
  const legacy = !quote.type && !!quote.items?.length;

  return (
    <div id={DOC_ID} className="mx-auto w-full max-w-[210mm] space-y-4 bg-white p-6 text-[11px] text-neutral-900">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b-2 border-[#c4b5f0] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={company.logo || lepdoaccountlogo} alt={company.name || "LEPDO"} className="h-12 w-auto rounded object-contain" />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight">{company.name}</div>
            <div className="text-[10px] text-neutral-600">{company.address}</div>
            <div className="text-[10px] text-neutral-600">{company.email} · {company.phone}</div>
            <div className="text-[10px] text-neutral-600">{company.website}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold">{isInvoice ? "INVOICE" : "QUOTATION"}</div>
          <div className="font-medium">{isInvoice ? quote.invoice!.number : quote.number}</div>
          <div className="text-neutral-600">Date: {dateLabel(isInvoice ? quote.invoice!.date : quote.date)}</div>
          <div className="text-neutral-600">
            {isInvoice ? `Due: ${dateLabel(quote.invoice!.dueDate)}` : `Valid until: ${dateLabel(quote.validUntil)}`}
          </div>
          {!isInvoice && quote.type ? <div className="text-neutral-600">Type: {quote.type}</div> : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#eef4fd] p-3">
          <div className="text-[9px] font-bold tracking-wide text-neutral-500">BILL TO</div>
          <div className="font-semibold">{quote.company}</div>
          {quote.contactPerson ? <div>{quote.contactPerson}</div> : null}
          {quote.billingAddress ? <div>{quote.billingAddress}</div> : null}
          {quote.country ? <div>{quote.country}</div> : null}
          <div>{[quote.whatsapp || quote.phone, quote.email].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="rounded-lg bg-[#f2eefc] p-3">
          <div className="text-[9px] font-bold tracking-wide text-neutral-500">DETAILS</div>
          <div>Sales contact: {seller?.name ?? "—"}</div>
          <div>Payment terms: {quote.paymentTerms}</div>
          <div>Delivery terms: {quote.deliveryTerms}</div>
          <div>Currency: {cur}</div>
          {isInvoice ? <div>Payment status: {quote.invoice!.status}</div> : null}
        </div>
      </section>

      {legacy ? (
        <DocTable
          head={["#", "Description", "Specs", "Qty", "Price", "Total"]}
          rows={(quote.items ?? []).map((it, i) => [
            String(i + 1), it.description,
            [it.shape, it.carat && `${it.carat} ct`, it.colour, it.clarity, it.certificate].filter(Boolean).join(" · "),
            String(it.quantity), amount(it.price, cur),
            amount(it.quantity * it.price * (1 - it.discount / 100), cur),
          ])}
        />
      ) : quote.type === "Jewelry" ? (
        <div className="space-y-3">
          {quote.jewelryItems.map((item, i) => {
            const t = jewelryItemTotals(item);
            return (
              <div key={item.id} className="break-inside-avoid rounded-lg border border-neutral-200">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-neutral-200 bg-[#fbfaff] p-2">
                  {item.image ? (
                    <img src={item.image} alt="" className="h-14 w-14 rounded object-contain" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded bg-neutral-100 text-[9px] text-neutral-400">No image</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold">{i + 1}. {item.description || item.sku || "Product"}</div>
                    <div className="text-neutral-600">
                      {[item.sku, item.category, `${item.metalType} ${item.karat} ${item.metalColour}`].filter(Boolean).join(" · ")}
                    </div>
                    {item.link ? <div className="break-all text-[9px] text-neutral-500">{item.link}</div> : null}
                  </div>
                  <div className="text-right font-semibold">{amount(t.total, cur)}</div>
                </div>
                <div className="grid gap-2 p-2 sm:grid-cols-2">
                  <div>
                    <div className="text-[9px] font-bold text-neutral-500">METAL</div>
                    <div>Gross weight: {item.grossWeight ?? "—"} g · Net weight: {item.netWeight ?? "—"} g</div>
                    <div>Rate: {amount(item.metalRate ?? 0, cur)}/g · Metal total: {amount(t.metalTotal, cur)}</div>
                    <div>Making: {amount(item.makingPerGram ?? 0, cur)}/g · Total: {amount(t.makingTotal, cur)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-neutral-500">DIAMONDS</div>
                    {item.diamonds.length ? item.diamonds.map((d) => (
                      <div key={d.id}>
                        {d.description || "Diamond"} — {d.pieces ?? 0} pcs · {d.carats ?? 0} ct · {amount(d.pricePerCt ?? 0, cur)}/ct ={" "}
                        {amount(diamondRowTotal(d), cur)}
                      </div>
                    )) : <div>—</div>}
                    <div className="font-medium">Diamond total: {amount(t.diamondTotal, cur)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DocTable
          head={["Sr.", "Image", "SKU", "Description", "Pcs", "Total cts", `Price/ct (${cur})`, `Amount (${cur})`]}
          rows={quote.diamondItems.map((r, i) => [
            String(i + 1),
            r.image ?? { image: null },
            r.sku || "—",
            [r.description, r.category].filter(Boolean).join(" · "),
            String(r.pieces ?? 0),
            String(r.carats ?? 0),
            amount(r.pricePerCt ?? 0, cur),
            amount(diamondRowTotal(r), cur),
          ].map((c, ci) => (ci === 1 ? (r.image ? { image: r.image } : "—") : (c as string))))}
        />
      )}

      <section className="flex justify-end">
        <div className="w-full max-w-[280px] space-y-1">
          {quote.type === "Diamond" && !legacy ? (
            <>
              <Line label="Total pieces" value={String(totals.totalPieces)} />
              <Line label="Total carats" value={`${totals.totalCarats} ct`} />
            </>
          ) : null}
          {quote.type === "Jewelry" ? (
            <>
              <Line label="Metal amount" value={amount(totals.metalTotal, cur)} />
              <Line label="Diamond amount" value={amount(totals.diamondTotal, cur)} />
              <Line label="Making charges" value={amount(totals.makingTotal, cur)} />
            </>
          ) : null}
          <Line label="Subtotal" value={amount(totals.subtotal, cur)} />
          <Line label="Discount" value={`- ${amount(totals.discount, cur)}`} />
          <Line label="Shipping" value={amount(totals.shipping, cur)} />
          {totals.tax ? <Line label="Tax" value={amount(totals.tax, cur)} /> : null}
          {totals.otherCharges ? (
            <Line label="Other charges" value={amount(totals.otherCharges, cur)} />
          ) : null}
          <div className="flex justify-between rounded bg-[#e6f6ee] px-2 py-1.5 text-sm font-bold">
            <span>Grand total</span><span>{amount(totals.total, cur)}</span>
          </div>
          {isInvoice && quote.invoice?.amountPaid ? (
            <>
              <Line label="Amount received" value={amount(quote.invoice.amountPaid, cur)} />
              <Line label="Balance due" value={amount(totals.total - quote.invoice.amountPaid, cur)} />
            </>
          ) : null}
        </div>
      </section>

      {quote.notes ? (
        <section className="rounded-lg bg-[#fdf7e8] p-3">
          <div className="text-[9px] font-bold text-neutral-500">NOTES</div>
          <p className="whitespace-pre-wrap">{quote.notes}</p>
        </section>
      ) : null}

      <footer className="space-y-2 border-t border-neutral-200 pt-3 text-[10px] text-neutral-600">
        <div>
          <div className="text-[9px] font-bold text-neutral-500">TERMS & CONDITIONS</div>
          <p className="whitespace-pre-wrap">{isInvoice ? settings.invoiceTerms : quote.terms}</p>
        </div>
        <div className="flex justify-between">
          <span>Thank you for your business.</span>
          <span>{company.name} · {company.website}</span>
        </div>
      </footer>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DocTable({ head, rows }: { head: string[]; rows: (string | { image: string | null })[][] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-[#eef4fd] text-left">
          {head.map((h) => (
            <th key={h} className="border border-neutral-200 p-1.5 text-[10px] font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="break-inside-avoid align-top">
            {row.map((cell, ci) => (
              <td key={ci} className="border border-neutral-200 p-1.5">
                {typeof cell === "string" ? cell : cell.image
                  ? <img src={cell.image} alt="" className="h-12 w-12 object-contain" />
                  : "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Opens the browser print dialog for the rendered document (Save as PDF). */
export async function printDocument(quote: Quotation) {
  const node = document.getElementById(DOC_ID);
  if (!node) throw new Error("Document is not ready yet.");
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) throw new Error("Please allow pop-ups so the PDF can open.");
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("");
  win.document.write(
    `<html><head><title>${pdfFileName(quote).replace(/\.pdf$/, "")}</title>${styles}` +
      `<style>@page{size:A4;margin:12mm} body{background:#fff}</style></head>` +
      `<body>${node.outerHTML}</body></html>`,
  );
  win.document.close();
  await new Promise((r) => setTimeout(r, 700));
  win.focus();
  win.print();
}

export async function printWithRetry(quote: Quotation) {
  try {
    await printDocument(quote);
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "PDF could not be generated.", {
      action: { label: "Retry", onClick: () => void printDocument(quote).catch(() => toast.error("Still not working — the quotation is saved, try again from the list.")) },
    });
    return false;
  }
}
