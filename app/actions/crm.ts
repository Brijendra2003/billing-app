"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertCanWrite, getContext } from "@/lib/auth";
import { normalizePhone, stateCodeFromGstin, stateName } from "@/lib/india";
import type { FormState } from "@/app/actions/auth";

const text = (max = 500) => z.string().trim().max(max).default("");
const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .default("")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email address");

// ───────────────────────── Clients ─────────────────────────

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  company_name: text(200),
  gstin: text(15).transform((v) => v.toUpperCase()),
  email: optionalEmail,
  phone: text(20),
  whatsapp: text(20),
  address: text(),
  city: text(100),
  state_code: text(2),
  pincode: text(10),
  shipping_name: text(200),
  shipping_address: text(),
  shipping_city: text(100),
  shipping_state_code: text(2),
  shipping_pincode: text(10),
  tags: text(300),
  notes: text(4000),
  credit_days: z.coerce.number().int().min(0).max(365).default(0),
  opening_balance: z.coerce.number().default(0),
});

function clientRow(input: z.infer<typeof clientSchema>) {
  const stateCode = input.state_code || stateCodeFromGstin(input.gstin);
  const phone = normalizePhone(input.phone);
  return {
    ...input,
    phone,
    whatsapp: normalizePhone(input.whatsapp) || phone,
    state_code: stateCode,
    state: stateName(stateCode),
    shipping_state: stateName(input.shipping_state_code),
    tags: input.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export async function saveClient(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = formData.get("id")?.toString();
  const row = clientRow(parsed.data);

  let clientId = id;
  if (id) {
    const { error } = await ctx.supabase.from("clients").update(row).eq("id", id);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await ctx.supabase
      .from("clients")
      .insert({ ...row, business_id: ctx.business.id })
      .select("id")
      .single();
    if (error) return { error: friendly(error.message) };
    clientId = data.id;
  }
  redirect(`/clients/${clientId}`);
}

function friendly(msg: string) {
  return msg.includes("clients_name_uq") || msg.includes("products_name_uq")
    ? "That name already exists. Use a different name."
    : msg;
}

export async function archiveClient(id: string, archived: boolean) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  await ctx.supabase.from("clients").update({ is_archived: archived }).eq("id", id);
  redirect(archived ? "/clients" : `/clients/${id}`);
}

// ───────────────────────── Follow-ups ─────────────────────────

export async function addFollowup(formData: FormData) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const input = z
    .object({
      client_id: z.uuid(),
      due_on: z.iso.date(),
      note: z.string().trim().min(1).max(1000),
      document_id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    })
    .parse(Object.fromEntries(formData));
  await ctx.supabase.from("followups").insert({
    business_id: ctx.business.id,
    client_id: input.client_id,
    document_id: input.document_id ?? null,
    due_on: input.due_on,
    note: input.note,
    created_by: ctx.userId,
  });
}

export async function toggleFollowup(id: string, done: boolean) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  await ctx.supabase.from("followups").update({ done }).eq("id", id);
}

// ───────────────────────── Products ─────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  description: text(1000),
  hsn_sac: text(20),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  default_rate: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(100),
  pricing_mode: z.enum(["unit", "area"]).default("unit"),
});

export async function saveProduct(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = formData.get("id")?.toString();
  const { error } = id
    ? await ctx.supabase.from("products").update(parsed.data).eq("id", id)
    : await ctx.supabase.from("products").insert({ ...parsed.data, business_id: ctx.business.id });
  if (error) return { error: friendly(error.message) };
  return { message: id ? "Product updated." : "Product added." };
}

export async function archiveProduct(id: string) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  await ctx.supabase.from("products").update({ is_archived: true }).eq("id", id);
}

// ───────────────────────── Payments ─────────────────────────

const paymentSchema = z.object({
  document_id: z.uuid(),
  amount: z.coerce.number().positive("Amount must be more than 0"),
  paid_on: z.iso.date(),
  method: z.enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"]),
  reference: text(100),
  notes: text(500),
});

export async function recordPayment(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertCanWrite(ctx);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select("id, client_id, doc_type, status, balance_due")
    .eq("id", p.document_id)
    .maybeSingle();
  if (!doc) return { error: "Invoice not found" };
  if (!["tax_invoice", "proforma"].includes(doc.doc_type)) return { error: "Payments can only be recorded against invoices." };
  if (["draft", "cancelled"].includes(doc.status)) return { error: "Issue the invoice before recording a payment." };
  if (p.amount > Number(doc.balance_due) + 0.005) return { error: `Amount is more than the balance due (${doc.balance_due}).` };

  const { error } = await ctx.supabase.from("payments").insert({
    ...p,
    business_id: ctx.business.id,
    client_id: doc.client_id,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  await ctx.supabase.from("activity_log").insert({
    business_id: ctx.business.id,
    actor_id: ctx.userId,
    entity: "document",
    entity_id: doc.id,
    action: "payment_recorded",
    details: { amount: p.amount, method: p.method },
  });
  return { message: "Payment recorded." };
}

export async function deletePayment(id: string) {
  const ctx = await getContext();
  assertCanWrite(ctx);
  await ctx.supabase.from("payments").delete().eq("id", id);
}
