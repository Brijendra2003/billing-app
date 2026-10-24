import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, CheckCircle2, FileText, Plus, Receipt, UserPlus } from "lucide-react";
import { getContext } from "@/lib/auth";
import { displayStatus, normalizeDoc } from "@/lib/data/documents";
import { computeKpis, monthRange, shiftMonth, type ReportDoc, type ReportPayment } from "@/lib/reports/monthly";
import { TrendChart } from "@/components/charts";
import { Stat, StatusBadge } from "@/components/ui";
import { FollowupCheckbox } from "@/components/small-actions";
import { date, money, monthLabel, todayIST } from "@/lib/format";
import { DOC_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await getContext();
  const { password } = (await searchParams) as { password?: string };
  const today = todayIST();
  const month = today.slice(0, 7);
  const [trendStart] = monthRange(shiftMonth(month, -5));

  const [{ data: docsRaw }, { data: pays }, { data: open }, { data: recent }, { data: followups }, { data: quotes }] = await Promise.all([
    ctx.supabase
      .from("documents")
      .select("id, doc_type, status, number, issue_date, client_id, bill_to, place_of_supply_state_code, taxable_value, cgst, sgst, igst, freight_amount, grand_total, amount_paid, balance_due")
      .in("doc_type", ["tax_invoice", "credit_note"])
      .neq("status", "draft")
      .gte("issue_date", trendStart),
    ctx.supabase.from("payments").select("paid_on, amount, method").gte("paid_on", trendStart),
    ctx.supabase
      .from("documents")
      .select("id, number, bill_to, due_date, issue_date, balance_due, status, doc_type, valid_until")
      .eq("doc_type", "tax_invoice")
      .in("status", ["issued", "sent", "partially_paid"])
      .gt("balance_due", 0)
      .order("due_date"),
    ctx.supabase
      .from("documents")
      .select("id, doc_type, status, number, bill_to, issue_date, grand_total, due_date, valid_until, balance_due")
      .order("updated_at", { ascending: false })
      .limit(8),
    ctx.supabase.from("followups").select("id, note, due_on, done, client_id, clients(name)").eq("done", false).lte("due_on", today).order("due_on").limit(8),
    ctx.supabase.from("documents").select("id, grand_total").eq("doc_type", "quotation").in("status", ["issued", "sent"]),
  ]);

  const docs = (docsRaw ?? []).map((d) => normalizeDoc(d) as unknown as ReportDoc);
  const payments = (pays ?? []).map((p) => ({ ...p, amount: Number(p.amount) }) as ReportPayment);
  const k = computeKpis(docs, payments, month);
  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftMonth(month, i - 5);
    const t = computeKpis(docs, payments, ym);
    return { month: ym, sales: t.sales, collected: t.collected };
  });
  const openDocs = (open ?? []).map(normalizeDoc);
  const outstanding = openDocs.reduce((s, d) => s + d.balance_due, 0);
  const overdue = openDocs.filter((d) => d.due_date && d.due_date < today);
  const pendingQuotes = (quotes ?? []).reduce((s, q) => s + Number(q.grand_total), 0);

  return (
    <div className="space-y-5">
      {password === "updated" && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" /> Your password has been updated.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">{monthLabel(month)} at a glance</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <Link href="/clients/new" className="btn-secondary">
            <UserPlus className="size-4" /> Client
          </Link>
          <Link href="/quotations/new" className="btn-secondary">
            <FileText className="size-4" /> Quotation
          </Link>
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="size-4" /> Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales this month" value={money(k.sales)} hint={`${k.invoiceCount} invoices`} />
        <Stat label="Collected this month" value={money(k.collected)} tone="green" />
        <Stat
          label="Outstanding"
          value={money(outstanding)}
          tone={outstanding > 0 ? "red" : undefined}
          hint={overdue.length ? `${overdue.length} overdue` : "Nothing overdue"}
        />
        <Stat label="Open quotations" value={money(pendingQuotes)} hint={`${quotes?.length ?? 0} awaiting response`} />
      </div>

      <section className="card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GST included in this month&apos;s sales</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{money(k.totalTax)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:gap-8">
          {[
            ["Taxable value", k.taxable],
            ["CGST", k.cgst],
            ["SGST", k.sgst],
            ["IGST", k.igst],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="font-semibold tabular-nums text-slate-800">{money(value as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Sales vs collections</h2>
            <Link href="/reports" className="text-sm font-semibold text-brand-700 hover:underline">
              Full report →
            </Link>
          </div>
          <TrendChart data={trend} />
        </section>

        <section className="card card-pad">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Overdue invoices</h2>
            <Link href="/reports/receivables" className="text-sm font-semibold text-brand-700 hover:underline">
              All →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {overdue.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <Link href={`/documents/${d.id}`} className="font-semibold text-brand-700 hover:underline">
                    {d.number}
                  </Link>
                  <span className="block truncate text-xs text-slate-500">
                    {d.bill_to.name} · due {date(d.due_date)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-red-600">{money(d.balance_due)}</span>
              </li>
            ))}
            {overdue.length === 0 && (
              <li className="flex items-center gap-2 py-4 text-slate-500">
                <CheckCircle2 className="size-4 text-emerald-500" /> No overdue invoices.
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-2 font-bold">Recent activity</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {(recent ?? []).map((raw) => {
              const d = normalizeDoc(raw);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {d.doc_type === "quotation" ? <FileText className="size-4 shrink-0 text-slate-400" /> : <Receipt className="size-4 shrink-0 text-slate-400" />}
                    <span className="min-w-0">
                      <Link href={`/documents/${d.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                        {DOC_LABEL[d.doc_type]} {d.number ?? "(draft)"}
                      </Link>
                      <span className="block truncate text-xs text-slate-500">
                        {d.bill_to?.name} · {date(d.issue_date)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden tabular-nums sm:inline">{money(d.grand_total)}</span>
                    <StatusBadge status={displayStatus(d, today)} />
                  </span>
                </li>
              );
            })}
            {!recent?.length && (
              <li className="py-6 text-center text-slate-500">
                No documents yet.{" "}
                <Link href="/invoices/new" className="font-semibold text-brand-700">
                  Create your first invoice
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="mb-2 font-bold">Follow-ups due</h2>
          <ul className="space-y-2 text-sm">
            {(followups ?? []).map((f) => (
              <li key={f.id} className="flex items-start gap-2">
                <FollowupCheckbox id={f.id} done={f.done} />
                <span>
                  {f.note}
                  <span className={`block text-xs ${f.due_on < today ? "text-red-600" : "text-slate-500"}`}>
                    <Link href={`/clients/${f.client_id}?tab=followups`} className="hover:underline">
                      {(f.clients as unknown as { name: string } | null)?.name}
                    </Link>{" "}
                    · {date(f.due_on)}
                  </span>
                </span>
              </li>
            ))}
            {!followups?.length && (
              <li className="flex items-center gap-2 text-slate-500">
                <AlertCircle className="size-4 text-slate-300" /> Nothing due today.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
