import { describe, expect, it } from "vitest";
import { areaSqft, calculateTotals, type TotalsInput } from "@/lib/tax/calculate";

const base: TotalsInput = {
  items: [],
  taxMode: "auto",
  sellerStateCode: "27",
  placeOfSupplyStateCode: "27",
  freightAmount: 0,
  freightTaxable: false,
  freightTaxRate: 18,
  roundOff: false,
};

describe("calculateTotals", () => {
  it("splits CGST/SGST for intra-state supply", () => {
    const t = calculateTotals({ ...base, items: [{ qty: 2, rate: 500, tax_rate: 18 }] });
    expect(t.interState).toBe(false);
    expect(t.subtotal).toBe(1000);
    expect(t.cgst).toBe(90);
    expect(t.sgst).toBe(90);
    expect(t.igst).toBe(0);
    expect(t.grandTotal).toBe(1180);
  });

  it("uses IGST when place of supply differs (auto)", () => {
    const t = calculateTotals({ ...base, placeOfSupplyStateCode: "24", items: [{ qty: 1, rate: 1000, tax_rate: 18 }] });
    expect(t.interState).toBe(true);
    expect(t.igst).toBe(180);
    expect(t.cgst + t.sgst).toBe(0);
  });

  it("honours forced tax modes", () => {
    expect(calculateTotals({ ...base, taxMode: "igst", items: [{ qty: 1, rate: 100, tax_rate: 18 }] }).igst).toBe(18);
    expect(
      calculateTotals({ ...base, taxMode: "cgst_sgst", placeOfSupplyStateCode: "24", items: [{ qty: 1, rate: 100, tax_rate: 18 }] }).cgst,
    ).toBe(9);
  });

  it("adds untaxed freight after tax, like the old app", () => {
    const t = calculateTotals({ ...base, freightAmount: 150, items: [{ qty: 1, rate: 1000, tax_rate: 18 }] });
    expect(t.totalTax).toBe(180);
    expect(t.grandTotal).toBe(1330);
    expect(t.taxableValue).toBe(1000);
  });

  it("taxes freight when configured", () => {
    const t = calculateTotals({ ...base, freightAmount: 100, freightTaxable: true, items: [{ qty: 1, rate: 1000, tax_rate: 18 }] });
    expect(t.totalTax).toBe(198);
    expect(t.taxableValue).toBe(1100);
    expect(t.grandTotal).toBe(1298);
  });

  it("supports mixed rates with per-rate buckets", () => {
    const t = calculateTotals({
      ...base,
      items: [
        { qty: 1, rate: 100, tax_rate: 5 },
        { qty: 1, rate: 100, tax_rate: 18 },
        { qty: 1, rate: 100, tax_rate: 18 },
      ],
    });
    expect(t.buckets).toEqual([
      { rate: 5, taxable: 100, cgst: 2.5, sgst: 2.5, igst: 0 },
      { rate: 18, taxable: 200, cgst: 18, sgst: 18, igst: 0 },
    ]);
    expect(t.grandTotal).toBe(341);
  });

  it("applies line discount and round-off", () => {
    const t = calculateTotals({ ...base, roundOff: true, items: [{ qty: 3, rate: 33.33, tax_rate: 18, discount_pct: 10 }] });
    // 99.99 × 0.9 = 89.991 → 89.99; tax 16.20 → 106.19 → round to 106
    expect(t.subtotal).toBe(89.99);
    expect(t.totalTax).toBe(16.2);
    expect(t.roundOff).toBe(-0.19);
    expect(t.grandTotal).toBe(106);
  });

  it("prices by area in square feet", () => {
    expect(areaSqft(12, 12, "in")).toBeCloseTo(1);
    expect(areaSqft(2, 3, "ft")).toBeCloseTo(6);
    const t = calculateTotals({
      ...base,
      items: [{ qty: 2, rate: 100, tax_rate: 0, pricing_mode: "area", length: 24, breadth: 18, dimension_unit: "in" }],
    });
    // 2 × 3 sq ft × ₹100
    expect(t.subtotal).toBe(600);
  });

  it("does not drift with many small lines", () => {
    const items = Array.from({ length: 100 }, () => ({ qty: 1, rate: 0.1, tax_rate: 18 }));
    const t = calculateTotals({ ...base, items });
    expect(t.subtotal).toBe(10);
  });
});
