import "server-only";
import type { AppContext } from "@/lib/auth";
import { normalizeDoc, normalizeItem } from "@/lib/data/documents";
import { buildMonthlyReport, monthRange, shiftMonth, type ReportDoc, type ReportItem, type ReportPayment } from "@/lib/reports/monthly";

const DOC_COLS =
  "id, doc_type, status, number, issue_date, client_id, bill_to, place_of_supply_state_code, taxable_value, cgst, sgst, igst, freight_amount, grand_total, amount_paid, balance_due";

export async function loadMonthlyReport(ctx: AppContext, month: string) {
  const { supabase } = ctx;
  const [, end] = monthRange(month);
  const [trendStart] = monthRange(shiftMonth(month, -5));
  const [lyStart, lyEnd] = monthRange(shiftMonth(month, -12));

  const [recent, lastYear, payRecent, payLy] = await Promise.all([
    supabase.from("documents").select(DOC_COLS).neq("status", "draft").gte("issue_date", trendStart).lte("issue_date", end).limit(10000),
    supabase.from("documents").select(DOC_COLS).neq("status", "draft").gte("issue_date", lyStart).lte("issue_date", lyEnd).limit(10000),
    supabase.from("payments").select("paid_on, amount, method").gte("paid_on", trendStart).lte("paid_on", end).limit(10000),
    supabase.from("payments").select("paid_on, amount, method").gte("paid_on", lyStart).lte("paid_on", lyEnd).limit(10000),
  ]);

  const docs = [...(recent.data ?? []), ...(lastYear.data ?? [])].map((d) => normalizeDoc(d) as unknown as ReportDoc);
  const salesIds = docs
    .filter((d) => d.issue_date.startsWith(month) && (d.doc_type === "tax_invoice" || d.doc_type === "credit_note"))
    .map((d) => d.id);

  let items: ReportItem[] = [];
  for (let i = 0; i < salesIds.length; i += 200) {
    const { data } = await supabase
      .from("document_items")
      .select("document_id, name, hsn_sac, unit, qty, tax_rate, taxable_amount, cgst, sgst, igst")
      .in("document_id", salesIds.slice(i, i + 200));
    items = items.concat((data ?? []).map((r) => normalizeItem(r) as unknown as ReportItem));
  }

  const payments = [...(payRecent.data ?? []), ...(payLy.data ?? [])].map(
    (p) => ({ ...p, amount: Number(p.amount) }) as ReportPayment,
  );

  return buildMonthlyReport({ month, docs, items, payments, sellerStateCode: ctx.business.state_code });
}
