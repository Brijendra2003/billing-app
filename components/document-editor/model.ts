import type { DimUnit, DocType, PricingMode, TaxMode } from "@/lib/types";
import type { PartyInput } from "@/lib/validation/document";

export interface ClientOption {
  id: string;
  name: string;
  company_name: string;
  gstin: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state_code: string;
  pincode: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state_code: string;
  shipping_pincode: string;
}

export interface ProductOption {
  id: string;
  name: string;
  description: string;
  hsn_sac: string;
  unit: string;
  default_rate: number;
  tax_rate: number;
  pricing_mode: PricingMode;
}

export interface EditorItem {
  key: string;
  product_id: string | null;
  name: string;
  description: string;
  hsn_sac: string;
  unit: string;
  pricing_mode: PricingMode;
  length: string;
  breadth: string;
  dimension_unit: DimUnit;
  qty: string;
  rate: string;
  discount_pct: string;
  tax_rate: string;
}

export interface EditorState {
  id?: string;
  doc_type: DocType;
  status: string;
  number: string | null;
  client_id: string | null;
  bill_to: PartyInput;
  ship_enabled: boolean;
  ship_to: PartyInput;
  issue_date: string;
  due_date: string;
  valid_until: string;
  tax_mode: TaxMode;
  freight_enabled: boolean;
  freight_amount: string;
  freight_taxable: boolean;
  packaging_enabled: boolean;
  packaging_amount: string;
  packaging_taxable: boolean;
  apply_round_off: boolean;
  notes: string;
  terms: string;
  reference: string;
  converted_from_id: string | null;
  items: EditorItem[];
}

export interface EditorBusiness {
  state_code: string;
  default_tax_rate: number;
  auto_backup_drive: boolean;
}

export const emptyParty = (): PartyInput => ({
  name: "",
  company_name: "",
  gstin: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  state_code: "",
  pincode: "",
});

let keySeq = 0;
export const newItem = (taxRate: number, partial: Partial<EditorItem> = {}): EditorItem => ({
  key: `i${Date.now()}-${keySeq++}`,
  product_id: null,
  name: "",
  description: "",
  hsn_sac: "",
  unit: "pcs",
  pricing_mode: "unit",
  length: "",
  breadth: "",
  dimension_unit: "in",
  qty: "1",
  rate: "",
  discount_pct: "",
  tax_rate: String(taxRate),
  ...partial,
});
