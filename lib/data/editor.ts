import "server-only";
import type { AppContext } from "@/lib/auth";
import { addDays, todayIST } from "@/lib/format";
import { emptyParty, newItem, type ClientOption, type EditorState, type ProductOption } from "@/components/document-editor/model";
import { stateName } from "@/lib/india";
import type { DocType, DocumentItem, DocumentRow } from "@/lib/types";

export async function loadEditorOptions(ctx: AppContext) {
  const [{ data: clients }, { data: products }] = await Promise.all([
    ctx.supabase
      .from("clients")
      .select(
        "id, name, company_name, gstin, email, phone, address, city, state_code, pincode, shipping_name, shipping_address, shipping_city, shipping_state_code, shipping_pincode",
      )
      .eq("is_archived", false)
      .order("name"),
    ctx.supabase
      .from("products")
      .select("id, name, description, hsn_sac, unit, default_rate, tax_rate, pricing_mode")
      .eq("is_archived", false)
      .order("name"),
  ]);
  return {
    clients: (clients ?? []) as ClientOption[],
    products: (products ?? []).map((p) => ({ ...p, default_rate: Number(p.default_rate), tax_rate: Number(p.tax_rate) })) as ProductOption[],
    business: {
      state_code: ctx.business.state_code,
      default_tax_rate: Number(ctx.business.default_tax_rate),
      auto_backup_drive: ctx.business.auto_backup_drive,
    },
  };
}

export function blankEditorState(
  ctx: AppContext,
  docType: DocType,
  opts: { client?: ClientOption | null } = {},
): EditorState {
  const b = ctx.business;
  const today = todayIST();
  const c = opts.client;
  const taxRate = Number(b.default_tax_rate);
  return {
    doc_type: docType,
    status: "draft",
    number: null,
    client_id: c?.id ?? null,
    bill_to: c
      ? {
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
        }
      : emptyParty(),
    ship_enabled: Boolean(c?.shipping_address),
    ship_to: c?.shipping_address
      ? {
          ...emptyParty(),
          name: c.shipping_name || c.name,
          address: c.shipping_address,
          city: c.shipping_city,
          state_code: c.shipping_state_code,
          state: stateName(c.shipping_state_code),
          pincode: c.shipping_pincode,
        }
      : emptyParty(),
    issue_date: today,
    due_date: docType === "quotation" ? "" : addDays(today, b.default_due_days),
    valid_until: docType === "quotation" ? addDays(today, b.quotation_validity_days) : "",
    tax_mode: "auto",
    freight_enabled: false,
    freight_amount: "",
    freight_taxable: b.freight_taxable,
    packaging_enabled: false,
    packaging_amount: "",
    packaging_taxable: true,
    apply_round_off: b.round_off,
    notes: "",
    terms: docType === "quotation" ? b.quotation_terms : b.default_terms,
    reference: "",
    converted_from_id: null,
    items: [newItem(taxRate)],
  };
}

export function editorStateFromDocument(doc: DocumentRow, items: DocumentItem[]): EditorState {
  const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    id: doc.id,
    doc_type: doc.doc_type,
    status: doc.status,
    number: doc.number,
    client_id: doc.client_id,
    bill_to: { ...emptyParty(), ...doc.bill_to },
    ship_enabled: Boolean(doc.ship_to),
    ship_to: { ...emptyParty(), ...(doc.ship_to ?? {}) },
    issue_date: doc.issue_date,
    due_date: doc.due_date ?? "",
    valid_until: doc.valid_until ?? "",
    tax_mode: doc.tax_mode,
    freight_enabled: doc.freight_amount > 0,
    freight_amount: doc.freight_amount > 0 ? String(doc.freight_amount) : "",
    freight_taxable: doc.freight_taxable,
    packaging_enabled: doc.packaging_amount > 0,
    packaging_amount: doc.packaging_amount > 0 ? String(doc.packaging_amount) : "",
    packaging_taxable: doc.packaging_taxable,
    apply_round_off: doc.apply_round_off,
    notes: doc.notes,
    terms: doc.terms,
    reference: doc.reference,
    converted_from_id: doc.converted_from_id,
    items: items.map((it) =>
      newItem(it.tax_rate, {
        product_id: it.product_id,
        name: it.name,
        description: it.description,
        hsn_sac: it.hsn_sac,
        unit: it.unit,
        pricing_mode: it.pricing_mode,
        length: s(it.length),
        breadth: s(it.breadth),
        dimension_unit: it.dimension_unit ?? "in",
        qty: s(it.qty),
        rate: s(it.rate),
        discount_pct: it.discount_pct ? s(it.discount_pct) : "",
        tax_rate: s(it.tax_rate),
      }),
    ),
  };
}
