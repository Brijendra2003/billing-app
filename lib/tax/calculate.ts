import type { DimUnit, PricingMode, TaxMode } from "@/lib/types";

/** Inches per unit, used to convert dimensions to square feet. */
export const INCHES_PER: Record<DimUnit, number> = {
  in: 1,
  ft: 12,
  m: 39.37007874,
  yd: 36,
  cm: 0.3937007874,
  mm: 0.03937007874,
};

export const DIM_UNIT_LABEL: Record<DimUnit, string> = {
  in: "Inches",
  ft: "Feet",
  m: "Meters",
  yd: "Yards / Gaj",
  cm: "Centimeters",
  mm: "Millimeters",
};

/** Area of one piece in square feet. */
export function areaSqft(length: number, breadth: number, unit: DimUnit): number {
  const f = INCHES_PER[unit];
  return (length * f * (breadth * f)) / 144;
}

export interface LineInput {
  qty: number;
  rate: number;
  tax_rate: number;
  discount_pct?: number;
  pricing_mode?: PricingMode;
  length?: number | null;
  breadth?: number | null;
  dimension_unit?: DimUnit | null;
}

export interface TotalsInput {
  items: LineInput[];
  taxMode: TaxMode;
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
  freightAmount: number;
  freightTaxable: boolean;
  freightTaxRate: number;
  roundOff: boolean;
}

export interface LineResult {
  quantityBasis: number; // qty, or qty × area for area pricing
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface TaxBucket {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Totals {
  interState: boolean;
  lines: LineResult[];
  subtotal: number;
  freight: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  totalQty: number;
  buckets: TaxBucket[];
}

// All arithmetic is done in integer paise to avoid floating point drift.
const toPaise = (n: number) => Math.round((Number(n) || 0) * 100);
const fromPaise = (p: number) => p / 100;

export function isInterState(taxMode: TaxMode, sellerStateCode: string, posStateCode: string): boolean {
  if (taxMode === "igst") return true;
  if (taxMode === "cgst_sgst") return false;
  return Boolean(sellerStateCode && posStateCode && sellerStateCode !== posStateCode);
}

function splitTax(taxPaise: number, inter: boolean) {
  if (inter) return { cgst: 0, sgst: 0, igst: taxPaise };
  const cgst = Math.round(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst, igst: 0 };
}

export function calculateTotals(input: TotalsInput): Totals {
  const inter = isInterState(input.taxMode, input.sellerStateCode, input.placeOfSupplyStateCode);
  const buckets = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  const addBucket = (rate: number, taxable: number, t: { cgst: number; sgst: number; igst: number }) => {
    const b = buckets.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    b.taxable += taxable;
    b.cgst += t.cgst;
    b.sgst += t.sgst;
    b.igst += t.igst;
    buckets.set(rate, b);
  };

  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalQty = 0;

  const lines: LineResult[] = input.items.map((it) => {
    const qty = Number(it.qty) || 0;
    let basis = qty;
    if (it.pricing_mode === "area" && it.length && it.breadth && it.dimension_unit) {
      basis = qty * areaSqft(Number(it.length), Number(it.breadth), it.dimension_unit);
    }
    const gross = basis * (Number(it.rate) || 0);
    const disc = Math.min(Math.max(Number(it.discount_pct) || 0, 0), 100);
    const taxable = toPaise(gross * (1 - disc / 100));
    const rate = Number(it.tax_rate) || 0;
    const tax = Math.round((taxable * rate) / 100);
    const t = splitTax(tax, inter);

    subtotal += taxable;
    cgst += t.cgst;
    sgst += t.sgst;
    igst += t.igst;
    totalQty += qty;
    addBucket(rate, taxable, t);

    return {
      quantityBasis: basis,
      taxable: fromPaise(taxable),
      cgst: fromPaise(t.cgst),
      sgst: fromPaise(t.sgst),
      igst: fromPaise(t.igst),
      total: fromPaise(taxable + tax),
    };
  });

  const freight = Math.max(toPaise(input.freightAmount), 0);
  let taxableValue = subtotal;
  if (freight && input.freightTaxable) {
    const rate = Number(input.freightTaxRate) || 0;
    const t = splitTax(Math.round((freight * rate) / 100), inter);
    cgst += t.cgst;
    sgst += t.sgst;
    igst += t.igst;
    taxableValue += freight;
    addBucket(rate, freight, t);
  }

  const totalTax = cgst + sgst + igst;
  const exact = subtotal + freight + totalTax;
  const rounded = input.roundOff ? Math.round(exact / 100) * 100 : exact;

  return {
    interState: inter,
    lines,
    subtotal: fromPaise(subtotal),
    freight: fromPaise(freight),
    taxableValue: fromPaise(taxableValue),
    cgst: fromPaise(cgst),
    sgst: fromPaise(sgst),
    igst: fromPaise(igst),
    totalTax: fromPaise(totalTax),
    roundOff: fromPaise(rounded - exact),
    grandTotal: fromPaise(rounded),
    totalQty,
    buckets: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, b]) => ({
        rate,
        taxable: fromPaise(b.taxable),
        cgst: fromPaise(b.cgst),
        sgst: fromPaise(b.sgst),
        igst: fromPaise(b.igst),
      })),
  };
}
