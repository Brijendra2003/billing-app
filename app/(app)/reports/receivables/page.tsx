import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getContext } from "@/lib/auth";
import { normalizeDoc } from "@/lib/data/documents";
import { messageDefaults } from "@/lib/data/messages";
import { whatsappUrl } from "@/lib/messaging/templates";
import { PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { date, money, todayIST } from "@/lib/format";

export const metadata: Metadata = { title: "Receivables" };

const BUCKETS = [
  { key: "current", label: "Not yet due" },
  { key: "0-30", label: "1–30 days" },
  { key: "31-60", label: "31–60 days" },
  { key: "61-90", label: "61–90 days" },
  { key: "90+", label: "90+ days" },
] as const;

function bucket(daysOverdue: number) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export default async function ReceivablesPage() {
  const ctx = await getContext();
  const today = todayIST();
  const { data } = await ctx.supabase
    .from("documents")
    .select("*")
    .eq("doc_type", "tax_invoice")
    .in("status", ["issued", "sent", "partially_paid"])
    .gt("balance_due", 0)
    .order("due_date", { ascending: true });
  const docs = (data ?? []).map(normalizeDoc);

  const { data: clients } = await ctx.supabase
    .from("clients")
    .select("id, whatsapp, phone")
    .in("id", [...new Set(docs.map((d) => d.client_id).filter(Boolean))] as string[]);
  const phoneOf = new Map((clients ?? []).map((c) => [c.id, c.whatsapp || c.phone]));

  const rows = docs.map((d) => {
    const due = d.due_date ?? d.issue_date;
    const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    const phone = (d.client_id && phoneOf.get(d.client_id)) || d.bill_to.phone;
    return { d, days, b: bucket(days), phone, reminder: messageDefaults(ctx.business, d).reminder };
  });
  const totals = Object.fromEntries(BUCKETS.map((b) => [b.key, rows.filter((r) => r.b === b.key).reduce((s, r) => s + r.d.balance_due, 0)]));
  const total = rows.reduce((s, r) => s + r.d.balance_due, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/reports", label: "Reports" }}
        title="Receivables & ageing"
        subtitle={`${rows.length} unpaid invoices as of ${date(today)}`}
        actions={<PrintButton />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total outstanding" value={money(total)} tone={total > 0 ? "red" : undefined} />
        {BUCKETS.map((b) => (
          <Stat key={b.key} label={b.label} value={money(totals[b.key])} />
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th className="hidden sm:table-cell">Due</th>
              <th className="text-right">Overdue</th>
              <th className="text-right">Balance</th>
              <th className="no-print w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, days, phone, reminder }) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/documents/${d.id}`} className="font-semibold text-brand-700 hover:underline">
                    {d.number}
                  </Link>
                  <span className="block text-xs text-slate-500">{date(d.issue_date)}</span>
                </td>
                <td className="max-w-44 truncate">
                  {d.client_id ? (
                    <Link href={`/clients/${d.client_id}`} className="hover:underline">
                      {d.bill_to.name}
                    </Link>
                  ) : (
                    d.bill_to.name
                  )}
                </td>
                <td className="hidden whitespace-nowrap sm:table-cell">{date(d.due_date ?? d.issue_date)}</td>
                <td className={`whitespace-nowrap text-right ${days > 0 ? "font-semibold text-red-600" : "text-slate-500"}`}>
                  {days > 0 ? `${days} days` : "Not due"}
                </td>
                <td className="whitespace-nowrap text-right font-semibold tabular-nums">{money(d.balance_due)}</td>
                <td className="no-print">
                  {phone && (
                    <a href={whatsappUrl(phone, reminder)} target="_blank" rel="noopener" className="btn-whatsapp btn-sm">
                      <MessageCircle className="size-3.5" /> Remind
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  Nothing outstanding. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
