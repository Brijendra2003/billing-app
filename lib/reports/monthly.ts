import type { DocType, DocStatus, PaymentMethod } from "@/lib/types";

export interface ReportDoc {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  number: string | null;
  issue_date: string;
  client_id: string | null;
  bill_to: { name: string; gstin?: string };
  place_of_supply_state_code: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight_amount: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
}

export interface ReportItem {
  document_id: string;
  name: string;
  hsn_sac: string;
  unit: string;
  qty: number;
  tax_rate: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface ReportPayment {
  paid_on: string;
  amount: number;
  method: PaymentMethod;
}

export interface Kpis {
  sales: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  freight: number;
  invoiceCount: number;
  creditNoteCount: number;
  creditNotes: number;
  avgInvoice: number;
  collected: number;
  unpaid: number;
}

export interface MonthlyReport {
  month: string;
  kpis: Kpis;
  prev: Kpis;
  lastYear: Kpis;
  daily: { day: number; date: string; sales: number }[];
  trend: { month: string; sales: number; collected: number }[];
  register: (ReportDoc & { sign: 1 | -1 })[];
  byClient: { key: string; client_id: string | null; name: string; count: number; taxable: number; total: number; balance: number }[];
  byHsn: { hsn: string; name: string; unit: string; qty: number; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  gst: {
    b2b: { count: number; taxable: number; tax: number };
    b2c: { count: number; taxable: number; tax: number };
    intra: { taxable: number; cgst: number; sgst: number };
    inter: { taxable: number; igst: number };
    byRate: { rate: number; taxable: number; tax: number }[];
  };
  collections: { method: PaymentMethod; count: number; amount: number }[];
  quotations: { issued: number; accepted: number; converted: number; rejected: number; value: number; conversionRate: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isLive = (d: { status: DocStatus }) => d.status !== "draft" && d.status !== "cancelled";

/** "2026-10" → ["2026-10-01", "2026-10-31"] */
export function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const inMonth = (iso: string, ym: string) => iso.slice(0, 7) === ym;

export function computeKpis(docs: ReportDoc[], payments: ReportPayment[], ym: string): Kpis {
  const inv = docs.filter((d) => d.doc_type === "tax_invoice" && isLive(d) && inMonth(d.issue_date, ym));
  const cn = docs.filter((d) => d.doc_type === "credit_note" && isLive(d) && inMonth(d.issue_date, ym));
  const sum = (list: ReportDoc[], f: (d: ReportDoc) => number) => list.reduce((s, d) => s + f(d), 0);
  const net = (f: (d: ReportDoc) => number) => r2(sum(inv, f) - sum(cn, f));
  const sales = net((d) => d.grand_total);
  const cgst = net((d) => d.cgst);
  const sgst = net((d) => d.sgst);
  const igst = net((d) => d.igst);
  return {
    sales,
    taxable: net((d) => d.taxable_value),
    cgst,
    sgst,
    igst,
    totalTax: r2(cgst + sgst + igst),
    freight: net((d) => d.freight_amount),
    invoiceCount: inv.length,
    creditNoteCount: cn.length,
    creditNotes: r2(sum(cn, (d) => d.grand_total)),
    avgInvoice: inv.length ? r2(sum(inv, (d) => d.grand_total) / inv.length) : 0,
    collected: r2(payments.filter((p) => inMonth(p.paid_on, ym)).reduce((s, p) => s + p.amount, 0)),
    unpaid: r2(sum(inv, (d) => d.balance_due)),
  };
}

export function buildMonthlyReport(input: {
  month: string;
  docs: ReportDoc[]; // all non-draft docs from (month − 5) through month, plus the same month last year
  items: ReportItem[]; // items of this month's tax invoices and credit notes
  payments: ReportPayment[]; // payments from (month − 5) through month, plus same month last year
  sellerStateCode: string;
}): MonthlyReport {
  const { month, docs, items, payments, sellerStateCode } = input;
  const [start, end] = monthRange(month);
  const days = Number(end.slice(8));

  const monthDocs = docs.filter((d) => inMonth(d.issue_date, month));
  const sales = monthDocs.filter((d) => (d.doc_type === "tax_invoice" || d.doc_type === "credit_note") && isLive(d));
  const sign = (d: ReportDoc): 1 | -1 => (d.doc_type === "credit_note" ? -1 : 1);

  // Daily
  const daily = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, date, sales: 0 };
  });
  for (const d of sales) daily[Number(d.issue_date.slice(8)) - 1].sales += sign(d) * d.grand_total;
  daily.forEach((d) => (d.sales = r2(d.sales)));

  // 6-month trend
  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftMonth(month, i - 5);
    const k = computeKpis(docs, payments, ym);
    return { month: ym, sales: k.sales, collected: k.collected };
  });

  // Register (include cancelled for completeness; excluded from totals)
  const register = monthDocs
    .filter((d) => (d.doc_type === "tax_invoice" || d.doc_type === "credit_note") && d.status !== "draft")
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date) || (a.number ?? "").localeCompare(b.number ?? ""))
    .map((d) => ({ ...d, sign: sign(d) }));

  // By client
  const clients = new Map<string, MonthlyReport["byClient"][number]>();
  for (const d of sales) {
    const key = d.client_id ?? `name:${d.bill_to.name.toLowerCase()}`;
    const c = clients.get(key) ?? { key, client_id: d.client_id, name: d.bill_to.name, count: 0, taxable: 0, total: 0, balance: 0 };
    if (d.doc_type === "tax_invoice") c.count += 1;
    c.taxable = r2(c.taxable + sign(d) * d.taxable_value);
    c.total = r2(c.total + sign(d) * d.grand_total);
    if (d.doc_type === "tax_invoice") c.balance = r2(c.balance + d.balance_due);
    clients.set(key, c);
  }
  const byClient = [...clients.values()].sort((a, b) => b.total - a.total);

  // By HSN
  const docSign = new Map(sales.map((d) => [d.id, sign(d)]));
  const hsn = new Map<string, MonthlyReport["byHsn"][number]>();
  for (const it of items) {
    const sg = docSign.get(it.document_id);
    if (!sg) continue;
    const key = `${it.hsn_sac || "—"}|${it.tax_rate}`;
    const h = hsn.get(key) ?? { hsn: it.hsn_sac || "—", name: it.name, unit: it.unit, qty: 0, rate: it.tax_rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    h.qty = r2(h.qty + sg * it.qty);
    h.taxable = r2(h.taxable + sg * it.taxable_amount);
    h.cgst = r2(h.cgst + sg * it.cgst);
    h.sgst = r2(h.sgst + sg * it.sgst);
    h.igst = r2(h.igst + sg * it.igst);
    hsn.set(key, h);
  }
  const byHsn = [...hsn.values()].sort((a, b) => b.taxable - a.taxable);

  // GST summary
  const gst: MonthlyReport["gst"] = {
    b2b: { count: 0, taxable: 0, tax: 0 },
    b2c: { count: 0, taxable: 0, tax: 0 },
    intra: { taxable: 0, cgst: 0, sgst: 0 },
    inter: { taxable: 0, igst: 0 },
    byRate: [],
  };
  for (const d of sales) {
    const s = sign(d);
    const tax = d.cgst + d.sgst + d.igst;
    const bucket = d.bill_to.gstin ? gst.b2b : gst.b2c;
    if (d.doc_type === "tax_invoice") bucket.count += 1;
    bucket.taxable = r2(bucket.taxable + s * d.taxable_value);
    bucket.tax = r2(bucket.tax + s * tax);
    if (d.igst > 0 || (d.place_of_supply_state_code && d.place_of_supply_state_code !== sellerStateCode && d.cgst === 0)) {
      gst.inter.taxable = r2(gst.inter.taxable + s * d.taxable_value);
      gst.inter.igst = r2(gst.inter.igst + s * d.igst);
    } else {
      gst.intra.taxable = r2(gst.intra.taxable + s * d.taxable_value);
      gst.intra.cgst = r2(gst.intra.cgst + s * d.cgst);
      gst.intra.sgst = r2(gst.intra.sgst + s * d.sgst);
    }
  }
  const rates = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const h of byHsn) {
    const r = rates.get(h.rate) ?? { rate: h.rate, taxable: 0, tax: 0 };
    r.taxable = r2(r.taxable + h.taxable);
    r.tax = r2(r.tax + h.cgst + h.sgst + h.igst);
    rates.set(h.rate, r);
  }
  gst.byRate = [...rates.values()].sort((a, b) => a.rate - b.rate);

  // Collections
  const coll = new Map<PaymentMethod, { method: PaymentMethod; count: number; amount: number }>();
  for (const p of payments) {
    if (p.paid_on < start || p.paid_on > end) continue;
    const c = coll.get(p.method) ?? { method: p.method, count: 0, amount: 0 };
    c.count += 1;
    c.amount = r2(c.amount + p.amount);
    coll.set(p.method, c);
  }

  // Quotation funnel (quotations dated this month)
  const quotes = monthDocs.filter((d) => d.doc_type === "quotation" && isLive(d));
  const accepted = quotes.filter((q) => q.status === "accepted" || q.status === "converted").length;
  const converted = quotes.filter((q) => q.status === "converted").length;

  return {
    month,
    kpis: computeKpis(docs, payments, month),
    prev: computeKpis(docs, payments, shiftMonth(month, -1)),
    lastYear: computeKpis(docs, payments, shiftMonth(month, -12)),
    daily,
    trend,
    register,
    byClient,
    byHsn,
    gst,
    collections: [...coll.values()].sort((a, b) => b.amount - a.amount),
    quotations: {
      issued: quotes.length,
      accepted,
      converted,
      rejected: quotes.filter((q) => q.status === "rejected").length,
      value: r2(quotes.reduce((s, q) => s + q.grand_total, 0)),
      conversionRate: quotes.length ? Math.round((converted / quotes.length) * 100) : 0,
    },
  };
}
