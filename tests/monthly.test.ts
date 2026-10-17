import { describe, expect, it } from "vitest";
import { buildMonthlyReport, monthRange, shiftMonth, type ReportDoc } from "@/lib/reports/monthly";
import { buildLedger } from "@/lib/ledger";

const doc = (p: Partial<ReportDoc>): ReportDoc => ({
  id: Math.random().toString(36).slice(2),
  doc_type: "tax_invoice",
  status: "issued",
  number: "INV/1",
  issue_date: "2026-10-05",
  client_id: "c1",
  bill_to: { name: "Acme", gstin: "" },
  place_of_supply_state_code: "27",
  taxable_value: 1000,
  cgst: 90,
  sgst: 90,
  igst: 0,
  freight_amount: 0,
  grand_total: 1180,
  amount_paid: 0,
  balance_due: 1180,
  ...p,
});

describe("month helpers", () => {
  it("computes ranges and shifts across years", () => {
    expect(monthRange("2026-02")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(monthRange("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", -12)).toBe("2025-10");
  });
});

describe("buildMonthlyReport", () => {
  const inv1 = doc({ id: "a", number: "INV/1", balance_due: 0, amount_paid: 1180, status: "paid" });
  const inv2 = doc({
    id: "b",
    number: "INV/2",
    issue_date: "2026-10-20",
    client_id: "c2",
    bill_to: { name: "Beta", gstin: "24AAAAA0000A1Z5" },
    place_of_supply_state_code: "24",
    cgst: 0,
    sgst: 0,
    igst: 360,
    taxable_value: 2000,
    grand_total: 2360,
    balance_due: 2360,
  });
  const cancelled = doc({ id: "x", status: "cancelled", grand_total: 99999 });
  const draft = doc({ id: "y", status: "draft", grand_total: 5555 });
  const cn = doc({ id: "c", doc_type: "credit_note", number: "CN/1", issue_date: "2026-10-25", taxable_value: 100, cgst: 9, sgst: 9, grand_total: 118 });
  const lastMonth = doc({ id: "p", issue_date: "2026-09-15", grand_total: 590, taxable_value: 500, cgst: 45, sgst: 45 });
  const quote1 = doc({ id: "q1", doc_type: "quotation", status: "converted" });
  const quote2 = doc({ id: "q2", doc_type: "quotation", status: "sent" });

  const report = buildMonthlyReport({
    month: "2026-10",
    docs: [inv1, inv2, cancelled, draft, cn, lastMonth, quote1, quote2],
    items: [
      { document_id: "a", name: "Sign", hsn_sac: "3926", unit: "pcs", qty: 2, tax_rate: 18, taxable_amount: 1000, cgst: 90, sgst: 90, igst: 0 },
      { document_id: "b", name: "Sign", hsn_sac: "3926", unit: "pcs", qty: 4, tax_rate: 18, taxable_amount: 2000, cgst: 0, sgst: 0, igst: 360 },
      { document_id: "c", name: "Sign", hsn_sac: "3926", unit: "pcs", qty: 1, tax_rate: 18, taxable_amount: 100, cgst: 9, sgst: 9, igst: 0 },
      { document_id: "x", name: "Ignored", hsn_sac: "9999", unit: "pcs", qty: 1, tax_rate: 18, taxable_amount: 1, cgst: 0, sgst: 0, igst: 0 },
    ],
    payments: [
      { paid_on: "2026-10-06", amount: 1180, method: "upi" },
      { paid_on: "2026-09-20", amount: 590, method: "cash" },
    ],
    sellerStateCode: "27",
  });

  it("nets credit notes and excludes drafts/cancelled", () => {
    expect(report.kpis.sales).toBe(1180 + 2360 - 118);
    expect(report.kpis.taxable).toBe(2900);
    expect(report.kpis.invoiceCount).toBe(2);
    expect(report.kpis.creditNotes).toBe(118);
    expect(report.kpis.igst).toBe(360);
    expect(report.kpis.cgst).toBe(81);
    expect(report.kpis.collected).toBe(1180);
    expect(report.kpis.unpaid).toBe(2360);
    expect(report.prev.sales).toBe(590);
  });

  it("builds the register with cancelled rows but not drafts", () => {
    expect(report.register.map((r) => r.id)).toEqual(["a", "x", "b", "c"]);
  });

  it("splits GST into B2B/B2C and intra/inter", () => {
    expect(report.gst.b2b).toEqual({ count: 1, taxable: 2000, tax: 360 });
    expect(report.gst.b2c.taxable).toBe(900);
    expect(report.gst.inter).toEqual({ taxable: 2000, igst: 360 });
    expect(report.gst.intra.cgst).toBe(81);
  });

  it("summarises HSN, clients, daily and funnel", () => {
    expect(report.byHsn).toHaveLength(1);
    expect(report.byHsn[0]).toMatchObject({ hsn: "3926", qty: 5, taxable: 2900 });
    expect(report.byClient[0]).toMatchObject({ name: "Beta", total: 2360, balance: 2360 });
    expect(report.daily[4].sales).toBe(1180);
    expect(report.daily).toHaveLength(31);
    expect(report.trend.map((t) => t.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(report.quotations).toMatchObject({ issued: 2, converted: 1, conversionRate: 50 });
  });
});

describe("buildLedger", () => {
  it("keeps a running balance", () => {
    const l = buildLedger({
      openingBalance: 500,
      documents: [
        { id: "a", doc_type: "tax_invoice", status: "issued", number: "INV/1", issue_date: "2026-10-01", grand_total: 1000 },
        { id: "b", doc_type: "credit_note", status: "issued", number: "CN/1", issue_date: "2026-10-03", grand_total: 100 },
        { id: "d", doc_type: "tax_invoice", status: "draft", number: null, issue_date: "2026-10-04", grand_total: 9999 },
      ],
      payments: [{ paid_on: "2026-10-02", amount: 600, method: "upi", reference: "", document_id: "a" }],
    });
    expect(l.map((e) => e.balance)).toEqual([500, 1500, 900, 800]);
  });
});
