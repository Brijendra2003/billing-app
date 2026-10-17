import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { DocumentPdf } from "@/lib/pdf/document-pdf";
import { calculateTotals } from "@/lib/tax/calculate";
import type { Business, DocumentItem, DocumentRow } from "@/lib/types";

const business = {
  id: "b",
  name: "SN SAFETY SIGNAGES",
  address: "Unit No. 135, 1st Floor, Dewan Industrial Estate No. 1, Navghar Road",
  city: "Vasai East",
  state: "Maharashtra",
  state_code: "27",
  pincode: "401210",
  gstin: "27AOBPY0011L1ZZ",
  email: "snsafteysignages@gmail.com",
  phone: "918530072419",
  upi_id: "sn@upi",
  bank_account_name: "SN SAFETY SIGNAGES",
  bank_account_no: "006861900003847",
  bank_ifsc: "YESB0000068",
  bank_name: "Yes Bank",
  bank_branch: "Vasai East",
  default_tax_rate: 18,
  round_off: true,
} as Business;

const items = [
  { name: "Fire Exit Signage", description: "Photoluminescent, 3mm acrylic", hsn_sac: "3926", unit: "pcs", pricing_mode: "unit", qty: 10, rate: 450, discount_pct: 5, tax_rate: 18 },
  { name: "Flex board", description: "", hsn_sac: "4911", unit: "pcs", pricing_mode: "area", length: 36, breadth: 24, dimension_unit: "in", qty: 2, rate: 85, discount_pct: 0, tax_rate: 18 },
] as DocumentItem[];

describe("DocumentPdf", () => {
  it("renders a multi-section A4 invoice", async () => {
    const t = calculateTotals({
      items, taxMode: "auto", sellerStateCode: "27", placeOfSupplyStateCode: "24",
      freightAmount: 150, freightTaxable: false, freightTaxRate: 18, roundOff: true,
    });
    const doc = {
      doc_type: "tax_invoice", status: "issued", number: "INV/26-27/0001", issue_date: "2026-10-17", due_date: "2026-11-16",
      bill_to: { name: "Acme Industries", gstin: "24AAACA1234A1Z5", email: "a@acme.in", phone: "919876543210", address: "Plot 4, GIDC", city: "Vapi", state: "Gujarat", state_code: "24", pincode: "396195" },
      ship_to: null, place_of_supply_state_code: "24", tax_mode: "auto", freight_amount: 150, freight_taxable: false,
      freight_tax_rate: 18, apply_round_off: true, amount_paid: 0, balance_due: t.grandTotal, grand_total: t.grandTotal,
      notes: "Thank you!", terms: "1. Goods once sold will not be taken back.", reference: "PO-778",
    } as unknown as DocumentRow;
    const qr = await QRCode.toDataURL("upi://pay?pa=sn@upi&am=10", { margin: 0 });
    const buf = await renderToBuffer(<DocumentPdf business={business} doc={doc} items={items} assets={{ paymentQr: qr }} />);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const out = path.join(process.env.PDF_OUT_DIR ?? ".", "sample-invoice.pdf");
    if (process.env.PDF_OUT_DIR) fs.writeFileSync(out, buf);
  });
});
