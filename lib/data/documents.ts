import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentItem, DocumentRow } from "@/lib/types";

const NUMERIC_DOC_FIELDS = [
  "freight_amount", "freight_tax_rate", "subtotal", "taxable_value", "cgst", "sgst", "igst", "total_tax",
  "round_off", "grand_total", "amount_paid", "balance_due",
] as const;

const NUMERIC_ITEM_FIELDS = [
  "length", "breadth", "qty", "rate", "discount_pct", "tax_rate", "taxable_amount", "cgst", "sgst", "igst", "line_total",
] as const;

/** PostgREST returns numeric columns as strings; convert them back to numbers. */
export function normalizeDoc(row: object): DocumentRow {
  const r: Record<string, unknown> = { ...row };
  for (const f of NUMERIC_DOC_FIELDS) if (f in r && r[f] !== null) r[f] = Number(r[f]);
  return r as unknown as DocumentRow;
}

export function normalizeItem(row: Record<string, unknown>): DocumentItem {
  const r: Record<string, unknown> = { ...row };
  for (const f of NUMERIC_ITEM_FIELDS) if (r[f] !== null && r[f] !== undefined) r[f] = Number(r[f]);
  return r as unknown as DocumentItem;
}

export async function getDocumentWithItems(supabase: SupabaseClient, id: string) {
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc) return null;
  const { data: items } = await supabase
    .from("document_items")
    .select("*")
    .eq("document_id", id)
    .order("position");
  return { doc: normalizeDoc(doc), items: (items ?? []).map(normalizeItem) };
}

/** Overdue / expired are derived from dates rather than stored. */
export function displayStatus(
  doc: Pick<DocumentRow, "doc_type" | "status" | "due_date" | "valid_until" | "balance_due">,
  today: string,
) {
  if (doc.doc_type === "tax_invoice" && ["issued", "sent", "partially_paid"].includes(doc.status)) {
    if (doc.due_date && doc.due_date < today && doc.balance_due > 0) return "overdue" as const;
  }
  if (doc.doc_type === "quotation" && ["issued", "sent"].includes(doc.status)) {
    if (doc.valid_until && doc.valid_until < today) return "expired" as const;
  }
  return doc.status;
}

export function fileName(doc: Pick<DocumentRow, "doc_type" | "number" | "bill_to">): string {
  const n = (doc.number ?? "DRAFT").replace(/[^\w-]+/g, "-");
  const who = (doc.bill_to?.name ?? "").replace(/[^\w]+/g, "-").slice(0, 30);
  return `${n}${who ? "_" + who : ""}.pdf`;
}
