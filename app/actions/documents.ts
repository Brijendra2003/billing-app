"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertCanWrite, getContext, type AppContext } from "@/lib/auth";
import { documentSchema, type DocumentInput } from "@/lib/validation/document";
import { calculateTotals } from "@/lib/tax/calculate";
import { normalizePhone } from "@/lib/india";
import { addDays, monthLabel, todayIST } from "@/lib/format";
import { fileName, getDocumentWithItems, isEditable } from "@/lib/data/documents";
import { renderDocumentPdf } from "@/lib/pdf/render";
import { backupToDrive, sendEmailViaGas } from "@/lib/messaging/gas";
import type { DocType, DocumentRow } from "@/lib/types";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

async function log(ctx: AppContext, entityId: string, action: string, details: Record<string, unknown> = {}) {
  await ctx.supabase.from("activity_log").insert({
    business_id: ctx.business.id,
    actor_id: ctx.userId,
    entity: "document",
    entity_id: entityId,
    action,
    details,
  });
}

/** Escape LIKE wildcards so ilike behaves as a case-insensitive equality. */
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function resolveClient(ctx: AppContext, input: z.infer<typeof documentSchema>): Promise<string> {
  const { supabase, business } = ctx;
  if (input.client_id) {
    const { data } = await supabase.from("clients").select("id").eq("id", input.client_id).maybeSingle();
    if (data) return data.id;
  }
  const name = input.bill_to.name.trim();
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("is_archived", false)
    .ilike("name", likeExact(name))
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  // New client typed in the editor → remember it (same behaviour as the old app).
  const b = input.bill_to;
  const s = input.ship_to;
  const phone = normalizePhone(b.phone);
  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      business_id: business.id,
      name,
      company_name: b.company_name,
      gstin: b.gstin,
      email: b.email,
      phone,
      whatsapp: phone,
      address: b.address,
      city: b.city,
      state: b.state,
      state_code: b.state_code,
      pincode: b.pincode,
      shipping_name: s?.name ?? "",
      shipping_address: s?.address ?? "",
      shipping_city: s?.city ?? "",
      shipping_state: s?.state ?? "",
      shipping_state_code: s?.state_code ?? "",
      shipping_pincode: s?.pincode ?? "",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save client: ${error.message}`);
  return created.id;
}

async function resolveProducts(ctx: AppContext, items: z.infer<typeof documentSchema>["items"]) {
  const { supabase, business } = ctx;
  const { data: products } = await supabase.from("products").select("id, name").eq("is_archived", false);
  const byName = new Map((products ?? []).map((p) => [p.name.toLowerCase(), p.id as string]));
  const ids = new Set((products ?? []).map((p) => p.id as string));

  const out: (string | null)[] = [];
  for (const it of items) {
    if (it.product_id && ids.has(it.product_id)) {
      out.push(it.product_id);
      continue;
    }
    const key = it.name.trim().toLowerCase();
    let id = byName.get(key);
    if (!id) {
      const { data, error } = await supabase
        .from("products")
        .insert({
          business_id: business.id,
          name: it.name.trim(),
          description: it.description,
          hsn_sac: it.hsn_sac,
          unit: it.unit || "pcs",
          default_rate: it.rate,
          tax_rate: it.tax_rate,
          pricing_mode: it.pricing_mode,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Could not save product "${it.name}": ${error.message}`);
      id = data.id as string;
      byName.set(key, id);
    }
    out.push(id);
  }
  return out;
}

async function pdfBase64(ctx: AppContext, id: string) {
  const loaded = await getDocumentWithItems(ctx.supabase, id);
  if (!loaded) throw new Error("Document not found");
  const buf = await renderDocumentPdf(ctx.supabase, ctx.business, loaded.doc, loaded.items);
  return { ...loaded, base64: buf.toString("base64"), fileName: fileName(loaded.doc) };
}

function driveFolder(doc: Pick<DocumentRow, "doc_type" | "fy" | "issue_date">): string[] {
  const folder: Record<DocType, string> = {
    quotation: "Quotations",
    proforma: "Proforma Invoices",
    tax_invoice: "Invoices",
    credit_note: "Credit Notes",
  };
  return [doc.fy ?? "Drafts", folder[doc.doc_type], monthLabel(doc.issue_date.slice(0, 7))];
}

export async function saveDocument(
  raw: DocumentInput,
  opts: { issue: boolean; backup: boolean },
): Promise<ActionResult<{ id: string; number: string | null; warning?: string }>> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    const input = documentSchema.parse(raw);
    const { supabase, business } = ctx;

    let existing: DocumentRow | null = null;
    if (input.id) {
      const { data } = await supabase.from("documents").select("*").eq("id", input.id).maybeSingle();
      if (!data) throw new Error("Document not found");
      existing = data as DocumentRow;
      if (!isEditable(existing)) throw new Error("Issued tax invoices can't be edited. Cancel it or issue a credit note.");
    }

    const clientId = await resolveClient(ctx, input);
    const productIds = await resolveProducts(ctx, input.items);

    const bill = { ...input.bill_to, phone: normalizePhone(input.bill_to.phone) };
    const ship = input.ship_to ? { ...input.ship_to, phone: normalizePhone(input.ship_to.phone) } : null;
    const pos = ship?.state_code || bill.state_code;
    const freightTaxRate = Number(business.default_tax_rate);
    const totals = calculateTotals({
      items: input.items,
      taxMode: input.tax_mode,
      sellerStateCode: business.state_code,
      placeOfSupplyStateCode: pos,
      freightAmount: input.freight_amount,
      freightTaxable: input.freight_taxable,
      freightTaxRate,
      roundOff: input.apply_round_off,
    });

    const row = {
      business_id: business.id,
      doc_type: input.doc_type,
      client_id: clientId,
      bill_to: bill,
      ship_to: ship,
      place_of_supply_state_code: pos,
      issue_date: input.issue_date,
      due_date: input.doc_type === "quotation" || input.doc_type === "credit_note" ? null : input.due_date,
      valid_until: input.doc_type === "quotation" ? input.valid_until : null,
      tax_mode: input.tax_mode,
      freight_amount: totals.freight,
      freight_taxable: input.freight_taxable,
      freight_tax_rate: freightTaxRate,
      apply_round_off: input.apply_round_off,
      subtotal: totals.subtotal,
      taxable_value: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      total_tax: totals.totalTax,
      round_off: totals.roundOff,
      grand_total: totals.grandTotal,
      notes: input.notes,
      terms: input.terms,
      reference: input.reference,
    };

    let id: string;
    if (existing) {
      // doc_type is fixed once created
      const { doc_type: _t, business_id: _b, ...update } = row;
      void _t;
      void _b;
      const { error } = await supabase.from("documents").update(update).eq("id", existing.id);
      if (error) throw new Error(error.message);
      id = existing.id;
      await supabase.from("document_items").delete().eq("document_id", id);
    } else {
      const { data, error } = await supabase
        .from("documents")
        .insert({ ...row, created_by: ctx.userId, converted_from_id: input.converted_from_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
      await log(ctx, id, "created");
    }

    const itemRows = input.items.map((it, i) => ({
      document_id: id,
      position: i,
      product_id: productIds[i],
      name: it.name,
      description: it.description,
      hsn_sac: it.hsn_sac,
      unit: it.unit || "pcs",
      pricing_mode: it.pricing_mode,
      length: it.pricing_mode === "area" ? it.length : null,
      breadth: it.pricing_mode === "area" ? it.breadth : null,
      dimension_unit: it.pricing_mode === "area" ? it.dimension_unit : null,
      qty: it.qty,
      rate: it.rate,
      discount_pct: it.discount_pct,
      tax_rate: it.tax_rate,
      taxable_amount: totals.lines[i].taxable,
      cgst: totals.lines[i].cgst,
      sgst: totals.lines[i].sgst,
      igst: totals.lines[i].igst,
      line_total: totals.lines[i].total,
    }));
    const { error: itemsError } = await supabase.from("document_items").insert(itemRows);
    if (itemsError) throw new Error(itemsError.message);

    if (existing && existing.status !== "draft") await log(ctx, id, "edited");

    let number = existing?.number ?? null;
    if (opts.issue && (!existing || existing.status === "draft")) {
      const { data, error } = await supabase.rpc("issue_document", { p_document: id });
      if (error) throw new Error(error.message);
      number = (data as DocumentRow).number;
    }

    let warning: string | undefined;
    if (opts.backup && number) {
      const pdf = await pdfBase64(ctx, id);
      const res = await backupToDrive({ fileName: pdf.fileName, base64: pdf.base64, folderPath: driveFolder(pdf.doc) });
      if (!res.ok) warning = `Saved, but Drive backup failed: ${res.error}`;
    }
    return { ok: true, id, number, warning };
  } catch (e) {
    return fail(e);
  }
}

export async function issueDocument(id: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    const { error } = await ctx.supabase.rpc("issue_document", { p_document: id });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDraft(id: string) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const { data } = await ctx.supabase.from("documents").select("status, doc_type, converted_from_id").eq("id", id).maybeSingle();
  if (!data || data.status !== "draft") throw new Error("Only drafts can be deleted.");

  // A draft created by "Convert" → hand the payments back and reopen the source,
  // otherwise deleting it would also delete the carried-over advance (payments cascade)
  // and leave the quotation/proforma stuck as "converted".
  if (data.converted_from_id && data.doc_type !== "credit_note") {
    const { data: source } = await ctx.supabase
      .from("documents")
      .select("id, doc_type, status")
      .eq("id", data.converted_from_id)
      .maybeSingle();
    if (source && source.status === "converted") {
      const { error } = await ctx.supabase
        .from("documents")
        .update({ status: source.doc_type === "quotation" ? "accepted" : "issued" })
        .eq("id", source.id);
      if (error) throw new Error(error.message);
      // The payments trigger recomputes the proforma's paid / part-paid status.
      const { error: payError } = await ctx.supabase.from("payments").update({ document_id: source.id }).eq("document_id", id);
      if (payError) throw new Error(payError.message);
    }
  }

  const { error } = await ctx.supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  redirect(data.doc_type === "quotation" ? "/quotations" : "/invoices");
}

export async function cancelDocument(id: string, reason: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    if (!reason.trim()) throw new Error("Please give a reason for cancelling.");
    const { data: doc } = await ctx.supabase.from("documents").select("status, amount_paid").eq("id", id).maybeSingle();
    if (!doc) throw new Error("Document not found");
    if (doc.status === "draft") throw new Error("Drafts can simply be deleted.");
    if (Number(doc.amount_paid) > 0) throw new Error("Remove the recorded payments before cancelling.");
    const { error } = await ctx.supabase
      .from("documents")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.trim() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await log(ctx, id, "cancelled", { reason });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setQuotationStatus(id: string, status: "accepted" | "rejected" | "sent"): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    const { error } = await ctx.supabase
      .from("documents")
      .update({ status })
      .eq("id", id)
      .eq("doc_type", "quotation")
      .in("status", ["issued", "sent", "accepted", "rejected"]);
    if (error) throw new Error(error.message);
    await log(ctx, id, status);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Creates a new draft from an existing document.
 * mode "convert": quotation → proforma/invoice, proforma → invoice (source marked converted)
 * mode "credit_note": invoice → credit note
 * mode "duplicate": same type, fresh dates
 */
export async function copyDocument(id: string, mode: "convert" | "credit_note" | "duplicate", target?: DocType) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const loaded = await getDocumentWithItems(ctx.supabase, id);
  if (!loaded) throw new Error("Document not found");
  const { doc, items } = loaded;
  const today = todayIST();

  let docType: DocType = doc.doc_type;
  if (mode === "convert") {
    if (!target || target === "quotation" || target === "credit_note") throw new Error("Invalid conversion");
    if (doc.doc_type !== "quotation" && !(doc.doc_type === "proforma" && target === "tax_invoice")) throw new Error("Invalid conversion");
    if (["draft", "cancelled", "converted"].includes(doc.status)) {
      throw new Error(doc.status === "converted" ? "This document has already been converted." : "Issue the document before converting it.");
    }
    docType = target;
  } else if (mode === "credit_note") {
    if (doc.doc_type !== "tax_invoice" || doc.status === "draft") throw new Error("Credit notes are issued against tax invoices.");
    docType = "credit_note";
  }

  const { data: created, error } = await ctx.supabase
    .from("documents")
    .insert({
      business_id: ctx.business.id,
      doc_type: docType,
      client_id: doc.client_id,
      bill_to: doc.bill_to,
      ship_to: doc.ship_to,
      place_of_supply_state_code: doc.place_of_supply_state_code,
      issue_date: today,
      due_date: docType === "quotation" || docType === "credit_note" ? null : addDays(today, ctx.business.default_due_days),
      valid_until: docType === "quotation" ? addDays(today, ctx.business.quotation_validity_days) : null,
      tax_mode: doc.tax_mode,
      freight_amount: doc.freight_amount,
      freight_taxable: doc.freight_taxable,
      freight_tax_rate: doc.freight_tax_rate,
      apply_round_off: doc.apply_round_off,
      subtotal: doc.subtotal,
      taxable_value: doc.taxable_value,
      cgst: doc.cgst,
      sgst: doc.sgst,
      igst: doc.igst,
      total_tax: doc.total_tax,
      round_off: doc.round_off,
      grand_total: doc.grand_total,
      notes: doc.notes,
      terms: docType === "quotation" ? ctx.business.quotation_terms : ctx.business.default_terms,
      reference: mode === "credit_note" ? (doc.number ?? "") : doc.reference,
      converted_from_id: mode === "duplicate" ? null : doc.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await ctx.supabase.from("document_items").insert(
    items.map((it) => {
      const { id: _id, document_id: _d, ...rest } = it;
      void _id;
      void _d;
      return { ...rest, document_id: created.id };
    }),
  );

  if (mode === "convert" && (doc.doc_type === "quotation" || doc.doc_type === "proforma")) {
    await ctx.supabase.from("documents").update({ status: "converted" }).eq("id", doc.id);
    // Advance received against a proforma carries over to the tax invoice.
    if (doc.doc_type === "proforma" && doc.amount_paid > 0) {
      await ctx.supabase.from("payments").update({ document_id: created.id }).eq("document_id", doc.id);
    }
  }
  await log(ctx, doc.id, mode === "duplicate" ? "duplicated" : mode === "credit_note" ? "credit_note_created" : "converted", {
    to: created.id,
  });
  redirect(`/documents/${created.id}/edit`);
}

export async function regenerateShareLink(id: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await ctx.supabase.from("documents").update({ share_token: token }).eq("id", id);
    if (error) throw new Error(error.message);
    await log(ctx, id, "share_link_reset");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function markSent(ctx: AppContext, doc: Pick<DocumentRow, "id" | "status">) {
  if (doc.status === "issued") await ctx.supabase.from("documents").update({ status: "sent" }).eq("id", doc.id);
}

const emailSchema = z.object({
  to: z.email("Enter a valid recipient email"),
  cc: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || v.split(",").every((x) => z.email().safeParse(x.trim()).success), "Invalid CC email"),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Message is required").max(10000),
  backup: z.boolean().default(false),
});

export async function sendDocumentEmail(id: string, raw: z.input<typeof emailSchema>): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    assertCanWrite(ctx);
    const input = emailSchema.parse(raw);
    const pdf = await pdfBase64(ctx, id);
    if (pdf.doc.status === "draft") throw new Error("Issue the document before sending it.");

    const res = await sendEmailViaGas({
      to: input.to,
      cc: input.cc || undefined,
      subject: input.subject,
      body: input.body,
      fromName: ctx.business.name,
      replyTo: ctx.business.email || undefined,
      attachment: { fileName: pdf.fileName, base64: pdf.base64 },
      backup: input.backup ? { folderPath: driveFolder(pdf.doc) } : undefined,
    });

    await ctx.supabase.from("communications").insert({
      business_id: ctx.business.id,
      document_id: id,
      client_id: pdf.doc.client_id,
      channel: "email",
      to_address: input.to,
      subject: input.subject,
      body: input.body,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error,
      created_by: ctx.userId,
    });
    if (!res.ok) throw new Error(res.error);
    await markSent(ctx, pdf.doc);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Records that the WhatsApp chat was opened for this document. */
export async function logWhatsapp(id: string, to: string, message: string, kind: "document" | "reminder" | "file") {
  const ctx = await getContext();
  const { data: doc } = await ctx.supabase.from("documents").select("id, status, client_id").eq("id", id).maybeSingle();
  if (!doc) return;
  await ctx.supabase.from("communications").insert({
    business_id: ctx.business.id,
    document_id: id,
    client_id: doc.client_id,
    channel: "whatsapp",
    to_address: to,
    subject: kind === "reminder" ? "Payment reminder" : kind === "file" ? "PDF shared" : "Document link",
    body: message,
    created_by: ctx.userId,
  });
  await markSent(ctx, doc as DocumentRow);
}
