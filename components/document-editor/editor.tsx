"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileCheck2, Plus, Printer, Save, Trash2, Truck } from "lucide-react";
import { Spinner } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { saveDocument } from "@/app/actions/documents";
import { calculateTotals, DIM_UNIT_LABEL, areaSqft } from "@/lib/tax/calculate";
import { STATES, stateCodeFromGstin, stateName } from "@/lib/india";
import { money, number } from "@/lib/format";
import { DOC_LABEL, type DimUnit, type TaxMode } from "@/lib/types";
import type { PartyInput } from "@/lib/validation/document";
import {
  emptyParty,
  newItem,
  type ClientOption,
  type EditorBusiness,
  type EditorItem,
  type EditorState,
  type ProductOption,
} from "./model";

const n = (v: string) => (v.trim() === "" ? 0 : Number(v));

function PartyFields({
  party,
  onChange,
  clients,
  onPickClient,
  nameLabel,
  showContact,
}: {
  party: PartyInput;
  onChange: (p: PartyInput) => void;
  clients?: ClientOption[];
  onPickClient?: (c: ClientOption) => void;
  nameLabel: string;
  showContact: boolean;
}) {
  const set = (k: keyof PartyInput, v: string) => onChange({ ...party, [k]: v });
  const options = useMemo(
    () =>
      (clients ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        sub: [c.company_name, c.city, c.phone && `+${c.phone}`].filter(Boolean).join(" · "),
      })),
    [clients],
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="label">{nameLabel}</span>
        {clients ? (
          <Combobox
            value={party.name}
            onChange={(v) => set("name", v)}
            onPick={(id) => {
              const c = clients.find((x) => x.id === id);
              if (c && onPickClient) onPickClient(c);
            }}
            options={options}
            placeholder="Type to search or enter a new client…"
            createLabel="New client"
          />
        ) : (
          <input className="input" value={party.name} onChange={(e) => set("name", e.target.value)} />
        )}
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Address</span>
        <textarea rows={2} className="input" value={party.address} onChange={(e) => set("address", e.target.value)} />
      </label>
      <label className="block">
        <span className="label">City</span>
        <input className="input" value={party.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Pincode</span>
        <input className="input" inputMode="numeric" value={party.pincode} onChange={(e) => set("pincode", e.target.value)} />
      </label>
      <label className="block">
        <span className="label">State (decides GST type)</span>
        <select
          className="input"
          value={party.state_code}
          onChange={(e) => onChange({ ...party, state_code: e.target.value, state: stateName(e.target.value) })}
        >
          <option value="">Select state</option>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">GSTIN</span>
        <input
          className="input uppercase"
          maxLength={15}
          value={party.gstin}
          onChange={(e) => {
            const gstin = e.target.value.toUpperCase();
            const code = stateCodeFromGstin(gstin);
            onChange({ ...party, gstin, ...(code ? { state_code: code, state: stateName(code) } : {}) });
          }}
        />
      </label>
      {showContact && (
        <>
          <label className="block">
            <span className="label">Mobile / WhatsApp</span>
            <input className="input" type="tel" value={party.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" value={party.email} onChange={(e) => set("email", e.target.value)} />
          </label>
        </>
      )}
    </div>
  );
}

export function DocumentEditor({
  initial,
  clients,
  products,
  business,
}: {
  initial: EditorState;
  clients: ClientOption[];
  products: ProductOption[];
  business: EditorBusiness;
}) {
  const router = useRouter();
  const [s, setS] = useState<EditorState>(initial);
  const [dirty, setDirty] = useState(false);
  const [backup, setBackup] = useState(business.auto_backup_drive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<"draft" | "issue" | "print" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const isDraft = s.status === "draft";
  const isQuote = s.doc_type === "quotation";
  const label = DOC_LABEL[s.doc_type];

  const update = (patch: Partial<EditorState>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const updateItem = (key: string, patch: Partial<EditorItem>) => {
    setS((prev) => ({ ...prev, items: prev.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const pos = (s.ship_enabled && s.ship_to.state_code) || s.bill_to.state_code;
  const totals = useMemo(
    () =>
      calculateTotals({
        items: s.items.map((it) => ({
          qty: n(it.qty),
          rate: n(it.rate),
          tax_rate: n(it.tax_rate),
          discount_pct: n(it.discount_pct),
          pricing_mode: it.pricing_mode,
          length: n(it.length) || null,
          breadth: n(it.breadth) || null,
          dimension_unit: it.dimension_unit,
        })),
        taxMode: s.tax_mode,
        sellerStateCode: business.state_code,
        placeOfSupplyStateCode: pos,
        freightAmount: s.freight_enabled ? n(s.freight_amount) : 0,
        freightTaxable: s.freight_taxable,
        freightTaxRate: business.default_tax_rate,
        roundOff: s.apply_round_off,
      }),
    [s, pos, business],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.name,
        sub: [p.hsn_sac && `HSN ${p.hsn_sac}`, `${money(p.default_rate)}${p.pricing_mode === "area" ? "/sq ft" : ""}`, `GST ${p.tax_rate}%`]
          .filter(Boolean)
          .join(" · "),
      })),
    [products],
  );

  function pickClient(c: ClientOption) {
    const hasShip = Boolean(c.shipping_address);
    update({
      client_id: c.id,
      bill_to: {
        name: c.name,
        company_name: c.company_name,
        gstin: c.gstin,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        state_code: c.state_code,
        state: stateName(c.state_code),
        pincode: c.pincode,
      },
      ship_enabled: hasShip,
      ship_to: hasShip
        ? {
            ...emptyParty(),
            name: c.shipping_name || c.name,
            address: c.shipping_address,
            city: c.shipping_city,
            state_code: c.shipping_state_code,
            state: stateName(c.shipping_state_code),
            pincode: c.shipping_pincode,
          }
        : s.ship_to,
    });
  }

  function pickProduct(key: string, id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    updateItem(key, {
      product_id: p.id,
      name: p.name,
      description: p.description,
      hsn_sac: p.hsn_sac,
      unit: p.unit,
      rate: String(p.default_rate),
      tax_rate: String(p.tax_rate),
      pricing_mode: p.pricing_mode,
    });
  }

  function submit(mode: "draft" | "issue" | "print") {
    setError(null);
    setSaving(mode);
    // Open the print window synchronously so pop-up blockers allow it.
    const printWindow = mode === "print" ? window.open("about:blank", "_blank") : null;

    startTransition(async () => {
      const res = await saveDocument(
        {
          id: s.id,
          doc_type: s.doc_type,
          client_id: s.client_id,
          bill_to: s.bill_to,
          ship_to: s.ship_enabled ? s.ship_to : null,
          issue_date: s.issue_date,
          due_date: s.due_date || null,
          valid_until: s.valid_until || null,
          tax_mode: s.tax_mode,
          freight_amount: s.freight_enabled ? n(s.freight_amount) : 0,
          freight_taxable: s.freight_taxable,
          apply_round_off: s.apply_round_off,
          notes: s.notes,
          terms: s.terms,
          reference: s.reference,
          converted_from_id: s.converted_from_id,
          items: s.items
            .filter((it) => it.name.trim() || n(it.rate))
            .map((it) => ({
              product_id: it.product_id,
              name: it.name,
              description: it.description,
              hsn_sac: it.hsn_sac,
              unit: it.unit,
              pricing_mode: it.pricing_mode,
              length: it.pricing_mode === "area" ? n(it.length) || null : null,
              breadth: it.pricing_mode === "area" ? n(it.breadth) || null : null,
              dimension_unit: it.pricing_mode === "area" ? it.dimension_unit : null,
              qty: n(it.qty),
              rate: n(it.rate),
              discount_pct: n(it.discount_pct),
              tax_rate: n(it.tax_rate),
            })),
        },
        { issue: mode !== "draft", backup: mode !== "draft" && backup },
      );

      if (!res.ok) {
        printWindow?.close();
        setError(res.error);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      setDirty(false);
      if (printWindow) printWindow.location.href = `/api/documents/${res.id}/pdf`;
      const q = res.warning ? `?warning=${encodeURIComponent(res.warning)}` : "";
      router.push(`/documents/${res.id}${q}`);
    });
  }

  function newDocument() {
    if (dirty && !confirm("Discard unsaved changes and start a new document?")) return;
    setDirty(false);
    router.push(isQuote ? "/quotations/new" : `/invoices/new?type=${s.doc_type}`);
  }

  return (
    <div ref={topRef} className="space-y-5 pb-28 sm:pb-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Document details */}
      <section className="card card-pad">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="block">
            <span className="label">{label} no.</span>
            <input className="input" disabled value={s.number ?? "Assigned when issued"} />
          </label>
          <label className="block">
            <span className="label">Date</span>
            <input type="date" className="input" value={s.issue_date} onChange={(e) => update({ issue_date: e.target.value })} />
          </label>
          {isQuote ? (
            <label className="block">
              <span className="label">Valid until</span>
              <input type="date" className="input" value={s.valid_until} onChange={(e) => update({ valid_until: e.target.value })} />
            </label>
          ) : s.doc_type === "credit_note" ? null : (
            <label className="block">
              <span className="label">Due date</span>
              <input type="date" className="input" value={s.due_date} onChange={(e) => update({ due_date: e.target.value })} />
            </label>
          )}
          <label className="block">
            <span className="label">Reference / PO no.</span>
            <input className="input" value={s.reference} onChange={(e) => update({ reference: e.target.value })} />
          </label>
        </div>
      </section>

      {/* Parties */}
      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{isQuote ? "Quotation for" : "Bill to"}</h2>
        <PartyFields
          party={s.bill_to}
          onChange={(p) => update({ bill_to: p, client_id: p.name === s.bill_to.name ? s.client_id : null })}
          clients={clients}
          onPickClient={pickClient}
          nameLabel="Customer name (auto-search)"
          showContact
        />
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={s.ship_enabled} onChange={(e) => update({ ship_enabled: e.target.checked })} />
          Ship to a different address?
        </label>
        {s.ship_enabled && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <PartyFields party={s.ship_to} onChange={(p) => update({ ship_to: p })} nameLabel="Shipping name" showContact={false} />
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Tax configuration</span>
            <select className="input bg-brand-50" value={s.tax_mode} onChange={(e) => update({ tax_mode: e.target.value as TaxMode })}>
              <option value="auto">Auto (based on state)</option>
              <option value="igst">Force IGST</option>
              <option value="cgst_sgst">Force CGST + SGST</option>
            </select>
          </label>
          <div className="flex items-end text-xs text-slate-500">
            {pos ? (
              <p>
                Place of supply: <b className="text-slate-700">{stateName(pos)}</b> →{" "}
                <b className="text-slate-700">{totals.interState ? "IGST" : "CGST + SGST"}</b>
              </p>
            ) : (
              <p>Select the customer&apos;s state to decide IGST vs CGST + SGST.</p>
            )}
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Items</h2>
        <div className="space-y-3">
          {s.items.map((it, idx) => {
            const line = totals.lines[idx];
            const area =
              it.pricing_mode === "area" && n(it.length) && n(it.breadth) ? areaSqft(n(it.length), n(it.breadth), it.dimension_unit) : 0;
            return (
              <div key={it.key} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-6 gap-2 md:grid-cols-12">
                  <label className="col-span-6 block md:col-span-4">
                    <span className="label">
                      {idx + 1}. Product name
                    </span>
                    <Combobox
                      value={it.name}
                      onChange={(v) => updateItem(it.key, { name: v, product_id: null })}
                      onPick={(id) => pickProduct(it.key, id)}
                      options={productOptions}
                      placeholder="Product…"
                      createLabel="New product"
                    />
                  </label>
                  <label className="col-span-2 block md:col-span-2">
                    <span className="label">HSN/SAC</span>
                    <input className="input" value={it.hsn_sac} onChange={(e) => updateItem(it.key, { hsn_sac: e.target.value })} />
                  </label>
                  <label className="col-span-2 block md:col-span-1">
                    <span className="label">Qty</span>
                    <input className="input" inputMode="decimal" value={it.qty} onChange={(e) => updateItem(it.key, { qty: e.target.value })} />
                  </label>
                  <label className="col-span-2 block md:col-span-2">
                    <span className="label">Rate{it.pricing_mode === "area" ? " / sq ft" : ""}</span>
                    <input className="input" inputMode="decimal" value={it.rate} onChange={(e) => updateItem(it.key, { rate: e.target.value })} />
                  </label>
                  <label className="col-span-2 block md:col-span-1">
                    <span className="label">GST %</span>
                    <select className="input px-2" value={it.tax_rate} onChange={(e) => updateItem(it.key, { tax_rate: e.target.value })}>
                      {["0", "5", "12", "18", "28"].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      {!["0", "5", "12", "18", "28"].includes(it.tax_rate) && <option value={it.tax_rate}>{it.tax_rate}</option>}
                    </select>
                  </label>
                  <div className="col-span-4 flex items-end justify-end gap-2 md:col-span-2">
                    <div className="text-right">
                      <span className="label">Amount</span>
                      <p className="py-2 text-sm font-bold tabular-nums">{money(line?.taxable ?? 0)}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost mb-0.5 px-2 text-slate-400 hover:text-red-600"
                      onClick={() => {
                        update({ items: s.items.length > 1 ? s.items.filter((x) => x.key !== it.key) : [newItem(business.default_tax_rate)] });
                      }}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <label className="col-span-6 block md:col-span-6">
                    <span className="label">Description (optional)</span>
                    <input className="input" value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} />
                  </label>
                  <label className="col-span-2 block md:col-span-2">
                    <span className="label">Unit</span>
                    <input className="input" value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })} />
                  </label>
                  <label className="col-span-2 block md:col-span-2">
                    <span className="label">Discount %</span>
                    <input className="input" inputMode="decimal" value={it.discount_pct} onChange={(e) => updateItem(it.key, { discount_pct: e.target.value })} placeholder="0" />
                  </label>
                  <label className="col-span-2 flex items-end pb-2 md:col-span-2">
                    <span className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={it.pricing_mode === "area"}
                        onChange={(e) => updateItem(it.key, { pricing_mode: e.target.checked ? "area" : "unit", unit: e.target.checked ? "pcs" : it.unit })}
                      />
                      Price by size
                    </span>
                  </label>

                  {it.pricing_mode === "area" && (
                    <div className="col-span-6 grid grid-cols-3 gap-2 rounded-md bg-brand-50 p-2 md:col-span-12 md:grid-cols-6">
                      <label className="block">
                        <span className="label">Length</span>
                        <input className="input" inputMode="decimal" value={it.length} onChange={(e) => updateItem(it.key, { length: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="label">Breadth</span>
                        <input className="input" inputMode="decimal" value={it.breadth} onChange={(e) => updateItem(it.key, { breadth: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="label">In</span>
                        <select className="input" value={it.dimension_unit} onChange={(e) => updateItem(it.key, { dimension_unit: e.target.value as DimUnit })}>
                          {(Object.keys(DIM_UNIT_LABEL) as DimUnit[]).map((u) => (
                            <option key={u} value={u}>
                              {DIM_UNIT_LABEL[u]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="col-span-3 self-end pb-2 text-xs text-slate-600">
                        {area ? (
                          <>
                            {number(area)} sq ft each × {it.qty || 0} = <b>{number(line?.quantityBasis ?? 0)} sq ft</b>
                          </>
                        ) : (
                          "Enter size to calculate area"
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn-ghost mt-3 text-brand-600"
          onClick={() => update({ items: [...s.items, newItem(business.default_tax_rate)] })}
        >
          <Plus className="size-4" /> Add new item
        </button>

        {/* Freight */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="size-4 accent-brand-600" checked={s.freight_enabled} onChange={(e) => update({ freight_enabled: e.target.checked })} />
            <Truck className="size-4 text-slate-400" /> Add courier/freight charges?
          </label>
          {s.freight_enabled && (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Amount (₹):
                <input className="input w-32" inputMode="decimal" placeholder="e.g. 150" value={s.freight_amount} onChange={(e) => update({ freight_amount: e.target.value })} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" className="size-4 accent-brand-600" checked={s.freight_taxable} onChange={(e) => update({ freight_taxable: e.target.checked })} />
                Charge GST on freight ({business.default_tax_rate}%)
              </label>
            </>
          )}
        </div>
      </section>

      {/* Notes + totals */}
      <section className="grid gap-5 md:grid-cols-5">
        <div className="card card-pad space-y-3 md:col-span-3">
          <label className="block">
            <span className="label">Terms & conditions</span>
            <textarea rows={4} className="input" value={s.terms} onChange={(e) => update({ terms: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Notes (shown on the document)</span>
            <textarea rows={2} className="input" value={s.notes} onChange={(e) => update({ notes: e.target.value })} />
          </label>
        </div>
        <div className="card card-pad md:col-span-2">
          <dl className="space-y-1.5 text-sm">
            <Row label="Sub total" value={money(totals.subtotal)} />
            {s.freight_enabled && totals.freight > 0 && s.freight_taxable && <Row label="Courier / freight" value={money(totals.freight)} />}
            {totals.interState ? (
              <Row label="IGST" value={money(totals.igst)} />
            ) : (
              <>
                <Row label="CGST" value={money(totals.cgst)} />
                <Row label="SGST" value={money(totals.sgst)} />
              </>
            )}
            {s.freight_enabled && totals.freight > 0 && !s.freight_taxable && <Row label="Courier / freight" value={money(totals.freight)} />}
            <div className="flex items-center justify-between text-slate-500">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-3.5 accent-brand-600" checked={s.apply_round_off} onChange={(e) => update({ apply_round_off: e.target.checked })} />
                Round off
              </label>
              <span className="tabular-nums">{money(totals.roundOff)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
              <dt className="text-base font-bold">Grand total</dt>
              <dd className="text-xl font-bold tabular-nums text-brand-700">{money(totals.grandTotal)}</dd>
            </div>
            <p className="text-right text-xs text-slate-500">Total qty: {number(totals.totalQty)}</p>
          </dl>
        </div>
      </section>

      {/* Actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="size-4 accent-brand-600" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
            Auto-save PDF to Drive
          </label>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <button type="button" className="btn-secondary" onClick={newDocument} disabled={pending}>
              <Plus className="size-4" /> New
            </button>
            {isDraft ? (
              <button type="button" className="btn-secondary" onClick={() => submit("draft")} disabled={pending}>
                {pending && saving === "draft" ? <Spinner /> : <Save className="size-4" />} Save draft
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => submit("issue")} disabled={pending}>
                {pending && saving === "issue" ? <Spinner /> : <FileCheck2 className="size-4" />} Save
              </button>
            )}
            <button type="button" className="btn-dark" onClick={() => submit("print")} disabled={pending}>
              {pending && saving === "print" ? <Spinner /> : <Printer className="size-4" />}
              Save & Print
            </button>
          </div>
        </div>
        {isDraft && (
          <p className="mx-auto mt-2 hidden max-w-7xl text-right text-xs text-slate-500 sm:block">
            <Copy className="mr-1 inline size-3" />
            &ldquo;Save & Print&rdquo; issues the {label.toLowerCase()} with the next number. New customers and products are remembered automatically.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd className="tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
