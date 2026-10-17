import Link from "next/link";
import type { Metadata } from "next";
import { getContext } from "@/lib/auth";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { DeletePaymentButton } from "@/components/small-actions";
import { monthRange, shiftMonth } from "@/lib/reports/monthly";
import { date, money, monthLabel, todayIST } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const ctx = await getContext();
  const { month: m } = (await searchParams) as { month?: string };
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : todayIST().slice(0, 7);
  const [start, end] = monthRange(month);

  const { data } = await ctx.supabase
    .from("payments")
    .select("id, amount, paid_on, method, reference, notes, document_id, client_id, documents(number, bill_to)")
    .gte("paid_on", start)
    .lte("paid_on", end)
    .order("paid_on", { ascending: false });
  const rows = (data ?? []).map((p) => ({
    ...p,
    amount: Number(p.amount),
    doc: p.documents as unknown as { number: string | null; bill_to: { name: string } } | null,
  }));
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const byMethod = new Map<string, number>();
  rows.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount));

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`Received in ${monthLabel(month)}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/payments?month=${shiftMonth(month, -1)}`} className="btn-secondary btn-sm">
              ← {monthLabel(shiftMonth(month, -1))}
            </Link>
            {month < todayIST().slice(0, 7) && (
              <Link href={`/payments?month=${shiftMonth(month, 1)}`} className="btn-secondary btn-sm">
                {monthLabel(shiftMonth(month, 1))} →
              </Link>
            )}
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total received" value={money(total)} tone="green" hint={`${rows.length} payments`} />
        {[...byMethod.entries()].slice(0, 3).map(([method, amt]) => (
          <Stat key={method} label={PAYMENT_METHOD_LABEL[method as PaymentMethod]} value={money(amt)} />
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No payments this month" body="Record payments from an invoice's page." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Client</th>
                <th className="hidden sm:table-cell">Method</th>
                <th className="hidden md:table-cell">Reference</th>
                <th className="text-right">Amount</th>
                {ctx.role !== "viewer" && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{date(p.paid_on)}</td>
                  <td>
                    <Link href={`/documents/${p.document_id}`} className="font-semibold text-brand-700 hover:underline">
                      {p.doc?.number ?? "—"}
                    </Link>
                  </td>
                  <td className="max-w-44 truncate">{p.doc?.bill_to?.name}</td>
                  <td className="hidden sm:table-cell">{PAYMENT_METHOD_LABEL[p.method as PaymentMethod]}</td>
                  <td className="hidden text-slate-500 md:table-cell">{p.reference}</td>
                  <td className="text-right font-semibold tabular-nums">{money(p.amount)}</td>
                  {ctx.role !== "viewer" && (
                    <td>
                      <DeletePaymentButton id={p.id} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
