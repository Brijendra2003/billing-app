import ExcelJS from "exceljs";
import { getContext } from "@/lib/auth";
import { loadMonthlyReport } from "@/lib/data/reports";
import { monthLabel, todayIST } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/types";

const MONEY = '"₹"#,##,##0.00;[Red]-"₹"#,##,##0.00';

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number; money?: boolean }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14, style: c.money ? { numFmt: MONEY } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  return ws;
}

export async function GET(request: Request) {
  const ctx = await getContext();
  const param = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : todayIST().slice(0, 7);
  const r = await loadMonthlyReport(ctx, month);
  const k = r.kpis;

  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.business.name;

  const summary = sheet(wb, "Summary", [
    { header: "Metric", key: "metric", width: 30 },
    { header: monthLabel(month), key: "now", width: 18, money: true },
    { header: "Previous month", key: "prev", width: 18, money: true },
    { header: "Same month last year", key: "ly", width: 22, money: true },
  ]);
  const rows: [string, keyof typeof k][] = [
    ["Net sales", "sales"],
    ["Taxable value", "taxable"],
    ["CGST", "cgst"],
    ["SGST", "sgst"],
    ["IGST", "igst"],
    ["Total GST", "totalTax"],
    ["Freight", "freight"],
    ["Credit notes", "creditNotes"],
    ["Average invoice", "avgInvoice"],
    ["Collected", "collected"],
    ["Unpaid from this month", "unpaid"],
  ];
  for (const [metric, key] of rows) summary.addRow({ metric, now: k[key], prev: r.prev[key], ly: r.lastYear[key] });
  const cnt = summary.addRow({ metric: "Number of invoices", now: k.invoiceCount, prev: r.prev.invoiceCount, ly: r.lastYear.invoiceCount });
  cnt.eachCell((c) => (c.numFmt = "0"));
  summary.addRow({});
  summary.addRow({ metric: `${ctx.business.name} · generated ${todayIST()}` });

  const reg = sheet(wb, "Invoice register", [
    { header: "Date", key: "date", width: 12 },
    { header: "Number", key: "number", width: 18 },
    { header: "Type", key: "type", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Client", key: "client", width: 30 },
    { header: "GSTIN", key: "gstin", width: 18 },
    { header: "Place of supply", key: "pos", width: 10 },
    { header: "Taxable", key: "taxable", money: true },
    { header: "CGST", key: "cgst", money: true },
    { header: "SGST", key: "sgst", money: true },
    { header: "IGST", key: "igst", money: true },
    { header: "Freight", key: "freight", money: true },
    { header: "Total", key: "total", money: true },
    { header: "Paid", key: "paid", money: true },
    { header: "Balance", key: "balance", money: true },
  ]);
  for (const d of r.register) {
    const s = d.status === "cancelled" ? 0 : d.sign;
    reg.addRow({
      date: d.issue_date,
      number: d.number,
      type: d.doc_type === "credit_note" ? "Credit note" : "Invoice",
      status: d.status,
      client: d.bill_to.name,
      gstin: d.bill_to.gstin ?? "",
      pos: d.place_of_supply_state_code,
      taxable: s * d.taxable_value,
      cgst: s * d.cgst,
      sgst: s * d.sgst,
      igst: s * d.igst,
      freight: s * d.freight_amount,
      total: s * d.grand_total,
      paid: d.doc_type === "tax_invoice" ? d.amount_paid : 0,
      balance: d.doc_type === "tax_invoice" && s ? d.balance_due : 0,
    });
  }

  const cl = sheet(wb, "Clients", [
    { header: "Client", key: "name", width: 32 },
    { header: "Invoices", key: "count", width: 10 },
    { header: "Taxable", key: "taxable", money: true },
    { header: "Net sales", key: "total", money: true },
    { header: "Unpaid", key: "balance", money: true },
  ]);
  r.byClient.forEach((c) => cl.addRow(c));

  const hsn = sheet(wb, "HSN summary", [
    { header: "HSN/SAC", key: "hsn", width: 12 },
    { header: "Description", key: "name", width: 30 },
    { header: "UQC", key: "unit", width: 8 },
    { header: "Quantity", key: "qty", width: 10 },
    { header: "GST rate %", key: "rate", width: 10 },
    { header: "Taxable", key: "taxable", money: true },
    { header: "IGST", key: "igst", money: true },
    { header: "CGST", key: "cgst", money: true },
    { header: "SGST", key: "sgst", money: true },
  ]);
  r.byHsn.forEach((h) => hsn.addRow(h));

  const gst = sheet(wb, "GST summary", [
    { header: "Category", key: "cat", width: 28 },
    { header: "Taxable", key: "taxable", money: true },
    { header: "Tax", key: "tax", money: true },
  ]);
  gst.addRow({ cat: `B2B (${r.gst.b2b.count} invoices)`, taxable: r.gst.b2b.taxable, tax: r.gst.b2b.tax });
  gst.addRow({ cat: `B2C (${r.gst.b2c.count} invoices)`, taxable: r.gst.b2c.taxable, tax: r.gst.b2c.tax });
  gst.addRow({ cat: "Intra-state (CGST+SGST)", taxable: r.gst.intra.taxable, tax: r.gst.intra.cgst + r.gst.intra.sgst });
  gst.addRow({ cat: "Inter-state (IGST)", taxable: r.gst.inter.taxable, tax: r.gst.inter.igst });
  r.gst.byRate.forEach((b) => gst.addRow({ cat: `Rate ${b.rate}%`, taxable: b.taxable, tax: b.tax }));

  const col = sheet(wb, "Collections", [
    { header: "Method", key: "method", width: 18 },
    { header: "Payments", key: "count", width: 10 },
    { header: "Amount", key: "amount", money: true },
  ]);
  r.collections.forEach((c) => col.addRow({ ...c, method: PAYMENT_METHOD_LABEL[c.method] }));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Sales-Report-${month}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
