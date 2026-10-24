import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentItem, DocumentRow } from "@/lib/types";

const NUMERIC_DOC_FIELDS = [
  "freight_amount", "freight_tax_rate", "packaging_amount", "packaging_tax_rate", "subtotal", "taxable_value", "cgst", "sgst", "igst", "total_tax",
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
  // One round-trip: the items are embedded in the document row.
  const { data } = await supabase
    .from("documents")
    .select("*, document_items(*)")
    .eq("id", id)
    .order("position", { referencedTable: "document_items" })
    .maybeSingle();
  if (!data) return null;
  const { document_items: items, ...doc } = data as { document_items: Record<string, unknown>[] | null };
  return { doc: normalizeDoc(doc), items: (items ?? []).map(normalizeItem) };
}

/** Documents that may still be edited after being issued (GST tax invoices / credit notes are frozen). */
export function isEditable(doc: Pick<DocumentRow, "status" | "doc_type">) {
  if (doc.status === "draft") return true;
  return (
    (doc.doc_type === "quotation" || doc.doc_type === "proforma") &&
    ["issued", "sent", "accepted", "rejected"].includes(doc.status)
  );
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
