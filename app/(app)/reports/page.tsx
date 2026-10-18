import Link from "next/link";
import Form from "next/form";
import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { getContext } from "@/lib/auth";
import { loadMonthlyReport } from "@/lib/data/reports";
import { shiftMonth } from "@/lib/reports/monthly";
import { DailySalesChart, TrendChart } from "@/components/charts";
import { PrintButton } from "@/components/print-button";
import { date, money, monthLabel, number, todayIST } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Monthly sales report" };

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before) return <span className="text-slate-400">No data {label}</span>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? "text-emerald-700" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% <span className="text-slate-500">{label}</span>
    </span>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card break-avoid overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = await getContext();
  const { month: m } = (await searchParams) as { month?: string };
  const current = todayIST().slice(0, 7);
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : current;
  const r = await loadMonthlyReport(ctx, month);
  const k = r.kpis;

  const tiles = [
    { label: "Net sales", value: money(k.sales), now: k.sales, prev: r.prev.sales, ly: r.lastYear.sales },
    { label: "Taxable value", value: money(k.taxable), now: k.taxable, prev: r.prev.taxable, ly: r.lastYear.taxable },
    { label: "GST collected", value: money(k.totalTax), now: k.totalTax, prev: r.prev.totalTax, ly: r.lastYear.totalTax },
    { label: "Collected", value: money(k.collected), now: k.collected, prev: r.prev.collected, ly: r.lastYear.collected },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">{ctx.business.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Monthly sales report · {monthLabel(month)}</h1>
          <p className="text-sm text-slate-500">
            Tax invoices net of credit notes. Drafts and cancelled documents are excluded. Generated {date(todayIST())}.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Link href={`/reports?month=${shiftMonth(month, -1)}`} className="btn-secondary btn-sm" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Link>
          <Form action="/reports" className="flex gap-2">
            <input type="month" name="month" defaultValue={month} max={current} className="input h-8 w-40 py-1" />
            <SubmitButton className="btn-secondary btn-sm">Go</SubmitButton>
          </Form>
          {month < current && (
            <Link href={`/reports?month=${shiftMonth(month, 1)}`} className="btn-secondary btn-sm" aria-label="Next month">
              <ChevronRight className="size-4" />
            </Link>
          )}
          <a href={`/api/reports/monthly?month=${month}`} className="btn-secondary btn-sm">
            <FileSpreadsheet className="size-4" /> Excel
          </a>
          <PrintButton />
          <Link href="/reports/receivables" className="btn-ghost btn-sm">
            Receivables →
          </Link>
        </div>
      </div>

      {/* 1. KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card break-avoid p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{t.value}</p>
            <p className="mt-1 text-xs">
              <Delta now={t.now} before={t.prev} label="vs last month" />
            </p>
            <p className="text-xs">
              <Delta now={t.now} before={t.ly} label="vs last year" />
            </p>
          </div>
        ))}
      </div>
      <div className="card grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Invoices", String(k.invoiceCount)],
          ["Average invoice", money(k.avgInvoice)],
          ["Credit notes", `${k.creditNoteCount} · ${money(k.creditNotes)}`],
          ["Freight billed", money(k.freight)],
          ["Unpaid from this month", money(k.unpaid)],
          ["Quotation conversion", `${r.quotations.conversionRate}% (${r.quotations.converted}/${r.quotations.issued})`],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="text-xs text-slate-500">{l}</p>
            <p className="font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {/* 2. Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Daily net sales">
          <div className="p-4">
            <DailySalesChart data={r.daily} month={month} />
          </div>
        </Section>
        <Section title="Last 6 months: sales vs collections">
          <div className="p-4">
            <TrendChart data={r.trend} />
          </div>
        </Section>
      </div>

      {/* 3. Register */}
      <Section title="Invoice register" note={`${r.register.length} documents`}>
        <table className="table-base text-xs sm:text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Number</th>
              <th>Client</th>
              <th className="hidden lg:table-cell">GSTIN</th>
              <th className="text-right">Taxable</th>
              <th className="hidden text-right md:table-cell">CGST</th>
              <th className="hidden text-right md:table-cell">SGST</th>
              <th className="hidden text-right md:table-cell">IGST</th>
              <th className="hidden text-right lg:table-cell">Freight</th>
              <th className="text-right">Total</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {r.register.map((d) => {
              const cancelled = d.status === "cancelled";
              const s = d.sign;
              return (
                <tr key={d.id} className={cancelled ? "text-slate-400 line-through" : ""}>
                  <td className="whitespace-nowrap">{date(d.issue_date)}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/documents/${d.id}`} className="text-brand-700 hover:underline">
                      {d.number}
                    </Link>
                    {s < 0 && <span className="ml-1 text-xs text-amber-700">(CN)</span>}
                  </td>
                  <td className="max-w-40 truncate">{d.bill_to.name}</td>
                  <td className="hidden font-mono text-xs lg:table-cell">{d.bill_to.gstin}</td>
                  <td className="text-right tabular-nums">{money(s * d.taxable_value)}</td>
                  <td className="hidden text-right tabular-nums md:table-cell">{money(s * d.cgst)}</td>
                  <td className="hidden text-right tabular-nums md:table-cell">{money(s * d.sgst)}</td>
                  <td className="hidden text-right tabular-nums md:table-cell">{money(s * d.igst)}</td>
                  <td className="hidden text-right tabular-nums lg:table-cell">{money(s * d.freight_amount)}</td>
                  <td className="text-right font-medium tabular-nums">{money(s * d.grand_total)}</td>
                  <td className="text-right tabular-nums">{d.doc_type === "tax_invoice" && !cancelled ? money(d.balance_due) : "—"}</td>
                </tr>
              );
            })}
            {r.register.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400">
                  No invoices this month.
                </td>
              </tr>
            )}
          </tbody>
          {r.register.length > 0 && (
            <tfoot className="font-bold">
              <tr>
                <td colSpan={3} className="px-3 py-2">
                  Total
                </td>
                <td className="hidden lg:table-cell" />
                <td className="px-3 py-2 text-right tabular-nums">{money(k.taxable)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{money(k.cgst)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{money(k.sgst)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{money(k.igst)}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{money(k.freight)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(k.sales)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(k.unpaid)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 4. Clients */}
        <Section title="Client-wise sales">
          <table className="table-base">
            <thead>
              <tr>
                <th>Client</th>
                <th className="text-right">Invoices</th>
                <th className="text-right">Net sales</th>
                <th className="text-right">Share</th>
                <th className="text-right">Unpaid</th>
              </tr>
            </thead>
            <tbody>
              {r.byClient.map((c) => (
                <tr key={c.key}>
                  <td className="max-w-44 truncate">
                    {c.client_id ? (
                      <Link href={`/clients/${c.client_id}`} className="text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="text-right">{c.count}</td>
                  <td className="text-right tabular-nums">{money(c.total)}</td>
                  <td className="text-right tabular-nums text-slate-500">{k.sales ? Math.round((c.total / k.sales) * 100) : 0}%</td>
                  <td className={`text-right tabular-nums ${c.balance > 0 ? "text-red-600" : "text-slate-400"}`}>{c.balance > 0 ? money(c.balance) : "—"}</td>
                </tr>
              ))}
              {r.byClient.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        {/* 5. HSN */}
        <Section title="HSN / product summary" note="GSTR-1 HSN-wise summary (items only; freight not included)">
          <table className="table-base">
            <thead>
              <tr>
                <th>HSN</th>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">GST</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">Tax</th>
              </tr>
            </thead>
            <tbody>
              {r.byHsn.map((h) => (
                <tr key={`${h.hsn}-${h.rate}`}>
                  <td className="font-mono text-xs">{h.hsn}</td>
                  <td className="max-w-40 truncate">{h.name}</td>
                  <td className="text-right tabular-nums">
                    {number(h.qty)} {h.unit}
                  </td>
                  <td className="text-right">{h.rate}%</td>
                  <td className="text-right tabular-nums">{money(h.taxable)}</td>
                  <td className="text-right tabular-nums">{money(h.cgst + h.sgst + h.igst)}</td>
                </tr>
              ))}
              {r.byHsn.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* 6. GST */}
        <Section title="GST summary" note="For GSTR-1 / GSTR-3B">
          <table className="table-base">
            <tbody>
              <tr>
                <td>B2B ({r.gst.b2b.count} inv.)</td>
                <td className="text-right tabular-nums">{money(r.gst.b2b.taxable)}</td>
                <td className="text-right tabular-nums">{money(r.gst.b2b.tax)}</td>
              </tr>
              <tr>
                <td>B2C ({r.gst.b2c.count} inv.)</td>
                <td className="text-right tabular-nums">{money(r.gst.b2c.taxable)}</td>
                <td className="text-right tabular-nums">{money(r.gst.b2c.tax)}</td>
              </tr>
              <tr>
                <td>Intra-state (CGST+SGST)</td>
                <td className="text-right tabular-nums">{money(r.gst.intra.taxable)}</td>
                <td className="text-right tabular-nums">{money(r.gst.intra.cgst + r.gst.intra.sgst)}</td>
              </tr>
              <tr>
                <td>Inter-state (IGST)</td>
                <td className="text-right tabular-nums">{money(r.gst.inter.taxable)}</td>
                <td className="text-right tabular-nums">{money(r.gst.inter.igst)}</td>
              </tr>
              {r.gst.byRate.map((b) => (
                <tr key={b.rate} className="text-slate-500">
                  <td>@ {b.rate}%</td>
                  <td className="text-right tabular-nums">{money(b.taxable)}</td>
                  <td className="text-right tabular-nums">{money(b.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 7. Collections */}
        <Section title="Collections by method">
          <table className="table-base">
            <tbody>
              {r.collections.map((c) => (
                <tr key={c.method}>
                  <td>
                    {PAYMENT_METHOD_LABEL[c.method]} <span className="text-xs text-slate-500">({c.count})</span>
                  </td>
                  <td className="text-right tabular-nums">{money(c.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Total</td>
                <td className="text-right tabular-nums">{money(k.collected)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* 8. Quotations */}
        <Section title="Quotation funnel">
          <table className="table-base">
            <tbody>
              <tr>
                <td>Quotations issued</td>
                <td className="text-right">{r.quotations.issued}</td>
              </tr>
              <tr>
                <td>Quoted value</td>
                <td className="text-right tabular-nums">{money(r.quotations.value)}</td>
              </tr>
              <tr>
                <td>Accepted</td>
                <td className="text-right">{r.quotations.accepted}</td>
              </tr>
              <tr>
                <td>Converted to invoice</td>
                <td className="text-right">{r.quotations.converted}</td>
              </tr>
              <tr>
                <td>Rejected</td>
                <td className="text-right">{r.quotations.rejected}</td>
              </tr>
              <tr className="font-bold">
                <td>Conversion rate</td>
                <td className="text-right">{r.quotations.conversionRate}%</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}
