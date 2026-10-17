"use server";

import { z } from "zod";
import { assertOwner, getContext } from "@/lib/auth";
import { normalizePhone, stateName } from "@/lib/india";
import { callGas } from "@/lib/messaging/gas";
import { financialYear } from "@/lib/india";
import { todayIST } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

const text = (max = 500) => z.string().trim().max(max).default("");
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const profileSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200),
  address: text(),
  city: text(100),
  state_code: text(2),
  pincode: text(10),
  gstin: text(15).transform((v) => v.toUpperCase()),
  pan: text(10).transform((v) => v.toUpperCase()),
  email: text(200),
  phone: text(20),
  website: text(200),
  upi_id: text(100),
  bank_account_name: text(200),
  bank_account_no: text(40),
  bank_ifsc: text(20).transform((v) => v.toUpperCase()),
  bank_name: text(100),
  bank_branch: text(100),
});

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertOwner(ctx);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const update: Record<string, unknown> = {
    ...d,
    phone: normalizePhone(d.phone),
    state: stateName(d.state_code),
  };

  // Branding uploads
  for (const [field, column] of [
    ["logo", "logo_path"],
    ["signature", "signature_path"],
    ["payment_qr", "payment_qr_path"],
  ] as const) {
    if (formData.get(`remove_${field}`) === "on") {
      update[column] = null;
      continue;
    }
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      if (!["image/png", "image/jpeg"].includes(file.type)) return { error: `${field}: please upload a PNG or JPG image.` };
      if (file.size > 2 * 1024 * 1024) return { error: `${field}: image must be under 2 MB.` };
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${ctx.business.id}/${field}-${Date.now()}.${ext}`;
      const { error } = await ctx.supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
      if (error) return { error: `Upload failed: ${error.message}` };
      update[column] = path;
    }
  }

  const { error } = await ctx.supabase.from("businesses").update(update).eq("id", ctx.business.id);
  if (error) return { error: error.message };
  return { message: "Business profile saved." };
}

const preferencesSchema = z.object({
  default_tax_rate: z.coerce.number().min(0).max(100),
  round_off: bool,
  freight_taxable: bool,
  auto_backup_drive: bool,
  default_due_days: z.coerce.number().int().min(0).max(365),
  quotation_validity_days: z.coerce.number().int().min(1).max(365),
  default_terms: text(4000),
  quotation_terms: text(4000),
});

export async function savePreferences(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertOwner(ctx);
  const parsed = preferencesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await ctx.supabase.from("businesses").update(parsed.data).eq("id", ctx.business.id);
  if (error) return { error: error.message };
  return { message: "Preferences saved." };
}

const numberingSchema = z.object({
  number_format: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((v) => v.includes("{SEQ}"), "Format must contain {SEQ}"),
  seq_padding: z.coerce.number().int().min(1).max(8),
  reset_yearly: bool,
  prefix_quotation: z.string().trim().min(1).max(10),
  prefix_proforma: z.string().trim().min(1).max(10),
  prefix_tax_invoice: z.string().trim().min(1).max(10),
  prefix_credit_note: z.string().trim().min(1).max(10),
  next_quotation: z.coerce.number().int().min(1).optional(),
  next_proforma: z.coerce.number().int().min(1).optional(),
  next_tax_invoice: z.coerce.number().int().min(1).optional(),
  next_credit_note: z.coerce.number().int().min(1).optional(),
});

export async function saveNumbering(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertOwner(ctx);
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = numberingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { next_quotation, next_proforma, next_tax_invoice, next_credit_note, ...settings } = parsed.data;

  const { error } = await ctx.supabase.from("businesses").update(settings).eq("id", ctx.business.id);
  if (error) return { error: error.message };

  const period = settings.reset_yearly ? financialYear(todayIST()) : "all";
  const seqs = [
    ["quotation", next_quotation],
    ["proforma", next_proforma],
    ["tax_invoice", next_tax_invoice],
    ["credit_note", next_credit_note],
  ] as const;
  for (const [docType, next] of seqs) {
    if (!next) continue;
    const { error: e } = await ctx.supabase
      .from("number_sequences")
      .upsert({ business_id: ctx.business.id, doc_type: docType, period, next_value: next });
    if (e) return { error: e.message };
  }
  return { message: "Numbering saved." };
}

const templatesSchema = z.object({
  email_subject_template: z.string().trim().min(1).max(300),
  email_body_template: z.string().trim().min(1).max(5000),
  whatsapp_template: z.string().trim().min(1).max(2000),
  reminder_template: z.string().trim().min(1).max(2000),
});

export async function saveTemplates(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getContext();
  assertOwner(ctx);
  const parsed = templatesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await ctx.supabase.from("businesses").update(parsed.data).eq("id", ctx.business.id);
  if (error) return { error: error.message };
  return { message: "Templates saved." };
}

export async function testGasConnection(): Promise<FormState> {
  const ctx = await getContext();
  assertOwner(ctx);
  const res = await callGas({ action: "ping" });
  if (!res.ok) return { error: res.error };
  return { message: `Connected as ${String(res.account ?? "")}. Emails left today: ${String(res.quota ?? "?")}.` };
}
