import { useMemo, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCrm, useCurrentUser } from "@/lib/store";
import { amount, diamondRowTotal, jewelryItemTotals, quotationTotals } from "@/lib/format";
import {
  KARAT_OPTIONS, METAL_COLOURS, METAL_TYPES, blankDiamondRow, blankJewelryDiamond,
  blankJewelryItem, numOrNull, readImageFile, validateQuotation,
} from "@/lib/quotation-helpers";
import type { DiamondRow, JewelryItem, Quotation } from "@/lib/types";

function Field({
  label, error, children, className,
}: { label: string; error?: string | undefined; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

function NumberInput({
  value, onChange, step = "any", min = 0, ...rest
}: { value: number | null; onChange: (v: number | null) => void; step?: string; min?: number } & Record<string, unknown>) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      className="h-9"
      value={value ?? ""}
      onChange={(e) => onChange(numOrNull(e.target.value))}
      {...rest}
    />
  );
}

function ImagePicker({
  value, onChange,
}: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {value ? (
          <img src={value} alt="Product" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => ref.current?.click()}>
          {value ? "Replace" : "Upload"}
        </Button>
        {value ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await readImageFile(file));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not add that image.");
          }
        }}
      />
    </div>
  );
}

export function QuotationForm({
  initial, onCancel, onSave,
}: {
  initial: Quotation;
  onCancel: () => void;
  onSave: (q: Quotation, finalize: boolean) => Promise<void> | void;
}) {
  const state = useCrm((s) => s);
  const admin = useCurrentUser().role === "super_admin";
  const [form, setForm] = useState<Quotation>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [typeSwitch, setTypeSwitch] = useState<Quotation["type"] | null>(null);

  // Blocks sidebar links, the browser Back button and tab close while edits
  // are unsaved. Entered values stay in `form` either way.
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !saving,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(
    Object.fromEntries((initial.jewelryItems ?? []).map((j) => [j.id, true])),
  );

  const totals = useMemo(() => quotationTotals(form), [form]);
  const set = (patch: Partial<Quotation>) => { setDirty(true); setForm((f) => ({ ...f, ...patch })); };

  const setDiamond = (id: string, patch: Partial<DiamondRow>) =>
    set({ diamondItems: form.diamondItems.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const setJewelry = (id: string, patch: Partial<JewelryItem>) =>
    set({ jewelryItems: form.jewelryItems.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  function changeType(next: Quotation["type"]) {
    if (next === form.type) return;
    const hasData = form.type === "Diamond"
      ? form.diamondItems.some((r) => r.description || r.sku || r.carats != null)
      : form.jewelryItems.length > 0;
    if (hasData) { setTypeSwitch(next); return; }
    applyType(next);
  }

  function applyType(next: Quotation["type"]) {
    const jewelry = next === "Jewelry" ? [blankJewelryItem()] : [];
    if (jewelry[0]) setOpenCards((o) => ({ ...o, [jewelry[0]!.id]: true }));
    set({
      type: next,
      diamondItems: next === "Diamond" ? [blankDiamondRow()] : [],
      jewelryItems: jewelry,
    });
    setTypeSwitch(null);
  }

  /** Returns true only when the quotation was actually saved. */
  async function submit(finalize: boolean) {
    if (saving) return false;
    const found = validateQuotation(form, finalize);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields. Your entries are kept.");
      return false;
    }
    setSaving(true);
    try {
      await onSave(form, finalize);
      setDirty(false);
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save. Your entries are still here.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  /**
   * One linked-customer list: data records and leads for the same company are
   * merged into a single choice that links both records to the quotation.
   */
  const customerOptions = useMemo(() => {
    const byCompany = new Map<string, { key: string; label: string; dataId?: string; leadId?: string }>();
    for (const d of state.data) {
      if (d.archived) continue;
      const k = d.company.trim().toLowerCase();
      if (!k || byCompany.has(k)) continue;
      byCompany.set(k, { key: k, label: `${d.company} — ${d.country || "—"}`, dataId: d.id });
    }
    for (const l of state.leads) {
      if (l.archived) continue;
      const k = l.company.trim().toLowerCase();
      if (!k) continue;
      const found = byCompany.get(k);
      if (found) {
        found.leadId = l.id;
        found.label = `${l.company} — ${l.country || "—"} · lead ${l.id}`;
      } else {
        byCompany.set(k, { key: k, label: `${l.company} — ${l.country || "—"} · lead ${l.id}`, leadId: l.id });
      }
    }
    return [...byCompany.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [state.data, state.leads]);

  const customerKey = form.company.trim().toLowerCase();

  const cur = form.currency;

  return (
    <div className="space-y-4 pb-24">
      {/* Quotation details */}
      <section className="card-soft p-4">
        <h2 className="mb-3 text-sm font-semibold">Quotation details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Quotation number">
            <Input className="h-9 bg-muted/40" value={form.number} readOnly />
          </Field>
          <Field label="Quotation date" error={errors["date"]}>
            <Input type="date" className="h-9" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Valid until" error={errors["validUntil"]}>
            <Input type="date" className="h-9" value={form.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
          </Field>
          <Field label="Quotation type">
            <div className="flex gap-2">
              {(["Diamond", "Jewelry"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={form.type === t ? "default" : "outline"}
                  className="h-9 flex-1"
                  onClick={() => changeType(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Currency">
            <select
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
              value={cur}
              onChange={(e) => set({ currency: e.target.value })}
            >
              {state.settings.currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {admin ? (
            <Field label="Assigned salesperson">
              <select
                className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                value={form.assignedTo}
                onChange={(e) => set({ assignedTo: e.target.value })}
              >
                {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          ) : null}
        </div>
      </section>

      {/* Customer */}
      <section className="card-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Customer details</h2>
          <select
            className="h-9 max-w-full rounded-lg border bg-background px-2 text-sm"
            aria-label="Linked customer"
            value={customerKey}
            onChange={(e) => {
              const opt = customerOptions.find((c) => c.key === e.target.value);
              if (!opt) { set({ dataId: undefined, leadId: undefined }); return; }
              const rec = opt.dataId ? state.data.find((d) => d.id === opt.dataId) : undefined;
              const lead = opt.leadId ? state.leads.find((l) => l.id === opt.leadId) : undefined;
              const src = rec ?? lead;
              if (!src) return;
              set({
                dataId: opt.dataId,
                leadId: opt.leadId,
                company: src.company,
                contactPerson: src.contactPerson,
                country: src.country,
                email: src.email,
                phone: src.phone,
                whatsapp: src.whatsapp,
                billingAddress: rec ? [rec.city, rec.country].filter(Boolean).join(", ") : form.billingAddress,
              });
              toast.success("Customer details filled in");
            }}
          >
            <option value="">Select a linked customer…</option>
            {customerOptions.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer / company *" error={errors["company"]}>
            <Input className="h-9" value={form.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label="Contact person">
            <Input className="h-9" value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input className="h-9" value={form.country} onChange={(e) => set({ country: e.target.value })} />
          </Field>
          <Field label="Mobile / WhatsApp (with country code)">
            <Input className="h-9" inputMode="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input className="h-9" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2 lg:col-span-1">
            <Input className="h-9" value={form.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} />
          </Field>
        </div>
      </section>

      {/* Products */}
      <section className="card-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {form.type === "Diamond" ? "Diamond products" : "Jewelry products"}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (form.type === "Diamond") set({ diamondItems: [...form.diamondItems, blankDiamondRow()] });
              else {
                const item = blankJewelryItem();
                setOpenCards((o) => ({ ...o, [item.id]: true }));
                set({ jewelryItems: [...form.jewelryItems, item] });
              }
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add product
          </Button>
        </div>
        {errors["items"] ? <p className="mb-2 text-[11px] text-destructive">{errors["items"]}</p> : null}

        {form.type === "Diamond" ? (
          <div className="space-y-3">
            {form.diamondItems.map((row, i) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Sr. No. {i + 1}</span>
                  <Button
                    type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                    onClick={() => set({ diamondItems: form.diamondItems.filter((r) => r.id !== row.id) })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Product image"><ImagePicker value={row.image} onChange={(v) => setDiamond(row.id, { image: v })} /></Field>
                  <Field label="SKU / Item ID"><Input className="h-9" value={row.sku} onChange={(e) => setDiamond(row.id, { sku: e.target.value })} /></Field>
                  <Field label="Category">
                    <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={row.category} onChange={(e) => setDiamond(row.id, { category: e.target.value })}>
                      <option value="">Select…</option>
                      {state.settings.categories.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Product link (optional)"><Input className="h-9" placeholder="https://…" value={row.link} onChange={(e) => setDiamond(row.id, { link: e.target.value })} /></Field>
                  <Field label="Description *" error={errors[`d.${row.id}.description`]} className="sm:col-span-2 lg:col-span-4">
                    <Input className="h-9" value={row.description} onChange={(e) => setDiamond(row.id, { description: e.target.value })} />
                  </Field>
                  <Field label="Pcs" error={errors[`d.${row.id}.pieces`]}>
                    <NumberInput step="1" value={row.pieces} onChange={(v) => setDiamond(row.id, { pieces: v })} />
                  </Field>
                  <Field label="Total carats (ct)" error={errors[`d.${row.id}.carats`]}>
                    <NumberInput step="0.001" value={row.carats} onChange={(v) => setDiamond(row.id, { carats: v })} />
                  </Field>
                  <Field label={`Price per carat (${cur})`} error={errors[`d.${row.id}.pricePerCt`]}>
                    <NumberInput step="0.01" value={row.pricePerCt} onChange={(v) => setDiamond(row.id, { pricePerCt: v })} />
                  </Field>
                  <Field label="Line total">
                    <div className="flex h-9 items-center rounded-lg bg-pastel-mint px-3 text-sm font-semibold">
                      {amount(diamondRowTotal(row), cur)}
                    </div>
                  </Field>
                </div>
              </div>
            ))}
            <div className="grid gap-2 rounded-lg bg-pastel-blue/60 p-3 text-xs sm:grid-cols-3">
              <div>Total pieces: <strong>{totals.totalPieces}</strong></div>
              <div>Total carats: <strong>{totals.totalCarats}</strong></div>
              <div>Diamond subtotal: <strong>{amount(totals.subtotal, cur)}</strong></div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {form.jewelryItems.map((item, i) => {
              const t = jewelryItemTotals(item);
              const open = openCards[item.id] ?? false;
              return (
                <div key={item.id} className="rounded-lg border">
                  <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 p-2.5">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-accent"
                      aria-label={open ? "Collapse product" : "Expand product"}
                      onClick={() => setOpenCards((o) => ({ ...o, [item.id]: !open }))}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border bg-muted/40 text-[10px] text-muted-foreground">
                      {item.image ? <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain" /> : `#${i + 1}`}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.sku || `Product ${i + 1}`}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.description || "No description yet"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="hidden text-sm font-semibold sm:inline">{amount(t.total, cur)}</span>
                      <Button
                        type="button" size="sm" variant="ghost" className="h-7 text-destructive"
                        aria-label="Remove product"
                        onClick={() => set({ jewelryItems: form.jewelryItems.filter((r) => r.id !== item.id) })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {open ? (
                    <div className="space-y-4 border-t p-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Product image"><ImagePicker value={item.image} onChange={(v) => setJewelry(item.id, { image: v })} /></Field>
                        <Field label="SKU / Item ID"><Input className="h-9" value={item.sku} onChange={(e) => setJewelry(item.id, { sku: e.target.value })} /></Field>
                        <Field label="Category">
                          <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={item.category} onChange={(e) => setJewelry(item.id, { category: e.target.value })}>
                            <option value="">Select…</option>
                            {state.settings.categories.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </Field>
                        <Field label="Product link (optional)"><Input className="h-9" placeholder="https://…" value={item.link} onChange={(e) => setJewelry(item.id, { link: e.target.value })} /></Field>
                        <Field label="Description *" error={errors[`j.${item.id}.description`]} className="sm:col-span-2 lg:col-span-4">
                          <Input className="h-9" value={item.description} onChange={(e) => setJewelry(item.id, { description: e.target.value })} />
                        </Field>
                      </div>

                      <div>
                        <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Metal details</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Metal type">
                            <select
                              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                              value={item.metalType}
                              onChange={(e) => setJewelry(item.id, { metalType: e.target.value, karat: KARAT_OPTIONS[e.target.value]?.[0] ?? "" })}
                            >
                              {METAL_TYPES.map((m) => <option key={m}>{m}</option>)}
                            </select>
                          </Field>
                          <Field label="Karat / purity">
                            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={item.karat} onChange={(e) => setJewelry(item.id, { karat: e.target.value })}>
                              {(KARAT_OPTIONS[item.metalType] ?? []).map((k) => <option key={k}>{k}</option>)}
                            </select>
                          </Field>
                          <Field label="Metal colour">
                            <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={item.metalColour} onChange={(e) => setJewelry(item.id, { metalColour: e.target.value })}>
                              {METAL_COLOURS.map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </Field>
                          <Field label="Gross weight (g)" error={errors[`j.${item.id}.grossWeight`]}>
                            <NumberInput step="0.001" value={item.grossWeight} onChange={(v) => setJewelry(item.id, { grossWeight: v })} />
                          </Field>
                          <Field label="Net metal weight (g)" error={errors[`j.${item.id}.netWeight`]}>
                            <NumberInput step="0.001" value={item.netWeight} onChange={(v) => setJewelry(item.id, { netWeight: v })} />
                          </Field>
                          <Field label={`Metal price per gram — ${item.karat} (${cur})`} error={errors[`j.${item.id}.metalRate`]}>
                            <NumberInput step="0.01" value={item.metalRate} onChange={(v) => setJewelry(item.id, { metalRate: v })} />
                          </Field>
                          <Field label="Metal total">
                            <div className="flex h-9 items-center rounded-lg bg-pastel-yellow px-3 text-sm font-semibold">{amount(t.metalTotal, cur)}</div>
                          </Field>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Diamond details</h3>
                          <Button
                            type="button" size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => setJewelry(item.id, { diamonds: [...item.diamonds, blankJewelryDiamond()] })}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add diamond row
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {item.diamonds.map((d, di) => (
                            <div key={d.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[auto_minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
                              <span className="text-xs text-muted-foreground sm:pb-2.5">{di + 1}.</span>
                              <Field label="Diamond description">
                                <Input className="h-9" value={d.description} onChange={(e) => setJewelry(item.id, { diamonds: item.diamonds.map((x) => (x.id === d.id ? { ...x, description: e.target.value } : x)) })} />
                              </Field>
                              <Field label="Pcs" error={errors[`jd.${d.id}.pieces`]}>
                                <NumberInput step="1" value={d.pieces} onChange={(v) => setJewelry(item.id, { diamonds: item.diamonds.map((x) => (x.id === d.id ? { ...x, pieces: v } : x)) })} />
                              </Field>
                              <Field label="Total cts" error={errors[`jd.${d.id}.carats`]}>
                                <NumberInput step="0.001" value={d.carats} onChange={(v) => setJewelry(item.id, { diamonds: item.diamonds.map((x) => (x.id === d.id ? { ...x, carats: v } : x)) })} />
                              </Field>
                              <Field label={`Price/ct (${cur})`} error={errors[`jd.${d.id}.pricePerCt`]}>
                                <NumberInput step="0.01" value={d.pricePerCt} onChange={(v) => setJewelry(item.id, { diamonds: item.diamonds.map((x) => (x.id === d.id ? { ...x, pricePerCt: v } : x)) })} />
                              </Field>
                              <div className="flex items-center justify-between gap-2 sm:pb-1">
                                <span className="text-sm font-medium">{amount(diamondRowTotal(d), cur)}</span>
                                <Button
                                  type="button" size="sm" variant="ghost" className="h-7 text-destructive" aria-label="Remove diamond row"
                                  onClick={() => setJewelry(item.id, { diamonds: item.diamonds.filter((x) => x.id !== d.id) })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Making charges</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label={`Making charge per gram (${cur})`}>
                            <NumberInput step="0.01" value={item.makingPerGram} onChange={(v) => setJewelry(item.id, { makingPerGram: v })} />
                          </Field>
                          <Field label="Net metal weight used (g)">
                            <Input className="h-9 bg-muted/40" readOnly value={item.netWeight ?? ""} />
                          </Field>
                          <Field label="Total making charges">
                            <div className="flex h-9 items-center rounded-lg bg-pastel-peach px-3 text-sm font-semibold">{amount(t.makingTotal, cur)}</div>
                          </Field>
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg bg-pastel-lavender/70 p-3 text-xs sm:grid-cols-5">
                        <div>Metal total<br /><strong>{amount(t.metalTotal, cur)}</strong></div>
                        <div>Diamond weight<br /><strong>{t.diamondCarats} ct</strong></div>
                        <div>Diamond amount<br /><strong>{amount(t.diamondTotal, cur)}</strong></div>
                        <div>Making charges<br /><strong>{amount(t.makingTotal, cur)}</strong></div>
                        <div>Product total<br /><strong>{amount(t.total, cur)}</strong></div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Summary + notes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-soft space-y-3 p-4">
          <h2 className="text-sm font-semibold">Notes and terms</h2>
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <Field label="Terms and conditions">
            <Textarea rows={4} value={form.terms} onChange={(e) => set({ terms: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment terms"><Input className="h-9" value={form.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
            <Field label="Delivery terms"><Input className="h-9" value={form.deliveryTerms} onChange={(e) => set({ deliveryTerms: e.target.value })} /></Field>
          </div>
        </section>

        <section className="card-soft space-y-2 p-4 text-sm">
          <h2 className="text-sm font-semibold">Amount summary</h2>
          {form.type === "Diamond" ? (
            <>
              <Row label="Total pieces" value={String(totals.totalPieces)} />
              <Row label="Total carats" value={`${totals.totalCarats} ct`} />
            </>
          ) : (
            <>
              <Row label="Total metal amount" value={amount(totals.metalTotal, cur)} />
              <Row label="Total diamond amount" value={amount(totals.diamondTotal, cur)} />
              <Row label="Total making charges" value={amount(totals.makingTotal, cur)} />
            </>
          )}
          <Row label="Product subtotal" value={amount(totals.subtotal, cur)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Discount (${cur})`} error={errors["discount"]}>
              <NumberInput step="0.01" value={form.discount} onChange={(v) => set({ discount: v ?? 0 })} />
            </Field>
            <Field label={`Shipping (${cur})`} error={errors["shipping"]}>
              <NumberInput step="0.01" value={form.shipping} onChange={(v) => set({ shipping: v ?? 0 })} />
            </Field>
            <Field label={`Tax (${cur}, optional)`} error={errors["tax"]}>
              <NumberInput step="0.01" value={form.tax ?? 0} onChange={(v) => set({ tax: v ?? 0 })} />
            </Field>
            <Field label={`Other charges (${cur}, optional)`} error={errors["otherCharges"]}>
              <NumberInput
                step="0.01"
                value={form.otherCharges ?? 0}
                onChange={(v) => set({ otherCharges: v ?? 0 })}
              />
            </Field>
          </div>
          {form.discount > totals.subtotal ? (
            <p className="text-[11px] text-destructive">Discount cannot be more than the product subtotal.</p>
          ) : null}
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Grand total</span>
            <span>{amount(Math.max(0, totals.total), cur)}</span>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => (dirty ? setConfirmLeave(true) : onCancel())}>Cancel</Button>
        <Button variant="outline" disabled={saving} onClick={() => void submit(false)}>Save draft</Button>
        <Button disabled={saving || form.discount > totals.subtotal} onClick={() => void submit(true)}>
          {saving ? "Saving…" : "Save & generate PDF"}
        </Button>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save this quotation as a draft, discard your edits, or stay on the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on page</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                if (await submit(false)) {
                  setConfirmLeave(false);
                  onCancel();
                }
              }}
            >
              Save draft
            </Button>
            <AlertDialogAction onClick={onCancel}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits have not been saved yet. Save them as a draft, discard them, or stay here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay on page</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                if (await submit(false)) blocker.proceed?.();
              }}
            >
              Save draft
            </Button>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={typeSwitch !== null} onOpenChange={(v) => !v && setTypeSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch quotation type?</AlertDialogTitle>
            <AlertDialogDescription>
              The product details already entered will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current products</AlertDialogCancel>
            <AlertDialogAction onClick={() => typeSwitch && applyType(typeSwitch)}>Switch and clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
