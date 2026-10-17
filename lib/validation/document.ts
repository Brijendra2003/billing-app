import { z } from "zod";

const str = (max = 500) => z.string().trim().max(max).default("");

export const partySchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  company_name: str(200),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .max(15)
    .default("")
    .refine((v) => v === "" || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "GSTIN must be 15 characters"),
  email: z
    .string()
    .trim()
    .max(200)
    .default("")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email"),
  phone: str(20),
  address: str(500),
  city: str(100),
  state: str(100),
  state_code: str(2),
  pincode: str(10),
});
export type PartyInput = z.infer<typeof partySchema>;

export const itemSchema = z.object({
  product_id: z.uuid().nullable().default(null),
  name: z.string().trim().min(1, "Every line needs an item name").max(300),
  description: str(1000),
  hsn_sac: str(20),
  unit: z.string().trim().max(20).default("pcs"),
  pricing_mode: z.enum(["unit", "area"]).default("unit"),
  length: z.number().positive().nullable().default(null),
  breadth: z.number().positive().nullable().default(null),
  dimension_unit: z.enum(["in", "ft", "m", "yd", "cm", "mm"]).nullable().default(null),
  qty: z.number().positive("Quantity must be more than 0"),
  rate: z.number().min(0, "Rate can't be negative"),
  discount_pct: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(100),
});
export type ItemInput = z.infer<typeof itemSchema>;

const isoDate = z.iso.date();

export const documentSchema = z.object({
  id: z.uuid().optional(),
  doc_type: z.enum(["quotation", "proforma", "tax_invoice", "credit_note"]),
  client_id: z.uuid().nullable().default(null),
  bill_to: partySchema,
  ship_to: partySchema.nullable().default(null),
  issue_date: isoDate,
  due_date: isoDate.nullable().default(null),
  valid_until: isoDate.nullable().default(null),
  tax_mode: z.enum(["auto", "igst", "cgst_sgst"]),
  freight_amount: z.number().min(0).default(0),
  freight_taxable: z.boolean().default(false),
  apply_round_off: z.boolean().default(true),
  notes: str(2000),
  terms: str(4000),
  reference: str(100),
  converted_from_id: z.uuid().nullable().default(null),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});
export type DocumentInput = z.input<typeof documentSchema>;
