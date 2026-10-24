export type DocType = "quotation" | "proforma" | "tax_invoice" | "credit_note";
export type DocStatus =
  | "draft"
  | "issued"
  | "sent"
  | "accepted"
  | "rejected"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "converted";
export type TaxMode = "auto" | "igst" | "cgst_sgst";
export type MemberRole = "owner" | "staff" | "viewer";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "card" | "other";
export type PricingMode = "unit" | "area";
export type DimUnit = "in" | "ft" | "m" | "yd" | "cm" | "mm";

export interface Business {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  website: string;
  logo_path: string | null;
  signature_path: string | null;
  payment_qr_path: string | null;
  upi_id: string;
  ca_name: string;
  ca_whatsapp: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_name: string;
  bank_branch: string;
  default_tax_rate: number;
  round_off: boolean;
  freight_taxable: boolean;
  auto_backup_drive: boolean;
  default_due_days: number;
  quotation_validity_days: number;
  default_terms: string;
  quotation_terms: string;
  number_format: string;
  seq_padding: number;
  reset_yearly: boolean;
  prefix_quotation: string;
  prefix_proforma: string;
  prefix_tax_invoice: string;
  prefix_credit_note: string;
  email_subject_template: string;
  email_body_template: string;
  whatsapp_template: string;
  reminder_template: string;
}

export interface Client {
  id: string;
  business_id: string;
  name: string;
  company_name: string;
  gstin: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_state_code: string;
  shipping_pincode: string;
  tags: string[];
  notes: string;
  credit_days: number;
  opening_balance: number;
  is_archived: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  hsn_sac: string;
  unit: string;
  default_rate: number;
  tax_rate: number;
  pricing_mode: PricingMode;
  is_archived: boolean;
}

/** Address snapshot stored on a document at the time it is saved. */
export interface Party {
  name: string;
  company_name?: string;
  gstin: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
}

export interface DocumentRow {
  id: string;
  business_id: string;
  doc_type: DocType;
  status: DocStatus;
  number: string | null;
  fy: string | null;
  issue_date: string;
  due_date: string | null;
  valid_until: string | null;
  client_id: string | null;
  bill_to: Party;
  ship_to: Party | null;
  place_of_supply_state_code: string;
  tax_mode: TaxMode;
  freight_amount: number;
  freight_taxable: boolean;
  freight_tax_rate: number;
  packaging_amount: number;
  packaging_taxable: boolean;
  packaging_tax_rate: number;
  apply_round_off: boolean;
  subtotal: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  notes: string;
  terms: string;
  reference: string;
  converted_from_id: string | null;
  share_token: string;
  issued_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  position: number;
  product_id: string | null;
  name: string;
  description: string;
  hsn_sac: string;
  unit: string;
  pricing_mode: PricingMode;
  length: number | null;
  breadth: number | null;
  dimension_unit: DimUnit | null;
  qty: number;
  rate: number;
  discount_pct: number;
  tax_rate: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
}

export interface Payment {
  id: string;
  document_id: string;
  client_id: string | null;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  created_at: string;
}

export interface Communication {
  id: string;
  document_id: string | null;
  client_id: string | null;
  channel: "email" | "whatsapp";
  to_address: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
}

export interface Followup {
  id: string;
  client_id: string;
  document_id: string | null;
  due_on: string;
  note: string;
  done: boolean;
  created_at: string;
}

export const DOC_LABEL: Record<DocType, string> = {
  quotation: "Quotation",
  proforma: "Proforma Invoice",
  tax_invoice: "Tax Invoice",
  credit_note: "Credit Note",
};

export const DOC_TITLE: Record<DocType, string> = {
  quotation: "QUOTATION",
  proforma: "PROFORMA INVOICE",
  tax_invoice: "TAX INVOICE",
  credit_note: "CREDIT NOTE",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};
