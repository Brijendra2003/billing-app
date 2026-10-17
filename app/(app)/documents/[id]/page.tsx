import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Mail, MessageCircle } from "lucide-react";
import { getContext } from "@/lib/auth";
import { displayStatus, fileName, getDocumentWithItems, normalizeDoc } from "@/lib/data/documents";
import { messageDefaults } from "@/lib/data/messages";
import { gasConfigured } from "@/lib/messaging/gas";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DocumentActions } from "@/components/document-actions";
import { DeletePaymentButton } from "@/components/small-actions";
import { date, dateTime, money, number, todayIST } from "@/lib/format";
import { stateName } from "@/lib/india";
import { DOC_LABEL, PAYMENT_METHOD_LABEL, type Communication, type Payment } from "@/lib/types";

export default async function DocumentPage({ params, searchParams }: PageProps<"/documents/[id]">) {
  const ctx = await getContext();
  const { id } = await params;
  const { warning } = await searchParams;
  const loaded = await getDocumentWithItems(ctx.supabase, id);
  if (!loaded) notFound();
  const { doc, items } = loaded;
  const today = todayIST();

  const [{ data: payments }, { data: comms }, { data: related }, { data: activity }] = await Promise.all([
    ctx.supabase.from("payments").select("*").eq("document_id", id).order("paid_on"),
    ctx.supabase.from("communications").select("*").eq("document_id", id).order("created_at", { ascending: false }).limit(20),
    ctx.supabase
      .from("documents")
      .select("id, doc_type, number, status, grand_total, converted_from_id")
      .or(`converted_from_id.eq.${id}${doc.converted_from_id ? `,id.eq.${doc.converted_from_id}` : ""}`),
    ctx.supabase.from("activity_log").select("action, details, created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(15),
  ]);

  const status = displayStatus(doc, today);
  const label = DOC_LABEL[doc.doc_type];
  const editable =
    doc.status === "draft" ||
    ((doc.doc_type === "quotation" || doc.doc_type === "proforma") && ["issued", "sent", "accepted", "rejected"].includes(doc.status));
  const listHref = doc.doc_type === "quotation" ? "/quotations" : "/invoices";
  const { data: client } = doc.client_id
    ? await ctx.supabase.from("clients").select("email, phone, whatsapp").eq("id", doc.client_id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: listHref, label: doc.doc_type === "quotation" ? "Quotations" : "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {label} {doc.number ?? "(draft)"} <StatusBadge status={status} />
          </span>
        }
        subtitle={
          <>
            {doc.client_id ? (
              <Link href={`/clients/${doc.client_id}`} className="font-medium text-brand-700 hover:underline">
                {doc.bill_to.name}
              </Link>
            ) : (
              doc.bill_to.name
            )}{" "}
            · {date(doc.issue_date)} · <b className="text-slate-700">{money(doc.grand_total)}</b>
          </>
        }
      />

      {typeof warning === "string" && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" /> {warning}
        </p>
      )}

      <div className="card card-pad no-print">
        <DocumentActions
          id={doc.id}
          docType={doc.doc_type}
          status={doc.status}
          number={doc.number}
          balanceDue={doc.balance_due}
          editable={editable}
          clientEmail={doc.bill_to.email || client?.email || ""}
          clientPhone={client?.whatsapp || doc.bill_to.phone || client?.phone || ""}
          fileName={fileName(doc)}
          today={today}
          autoBackup={ctx.business.auto_backup_drive}
          gasReady={gasConfigured()}
          messages={messageDefaults(ctx.business, doc)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>HSN</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id}>
                    <td>{i + 1}</td>
                    <td>
                      <p className="font-medium">{it.name}</p>
                      {it.description && <p className="text-xs text-slate-500">{it.description}</p>}
                      {it.pricing_mode === "area" && (
                        <p className="text-xs text-slate-500">
                          Size {number(it.length)} × {number(it.breadth)} {it.dimension_unit}
                        </p>
                      )}
                    </td>
                    <td>{it.hsn_sac}</td>
                    <td className="text-right tabular-nums">
                      {number(it.qty)} {it.unit}
                    </td>
                    <td className="text-right tabular-nums">
                      {money(it.rate)}
                      {it.pricing_mode === "area" ? "/sqft" : ""}
                    </td>
                    <td className="text-right">{number(it.tax_rate)}%</td>
                    <td className="text-right font-semibold tabular-nums">{money(it.taxable_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card hidden overflow-hidden md:block">
            <iframe src={`/api/documents/${doc.id}/pdf#view=FitH`} title="PDF preview" className="h-[75vh] w-full" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card card-pad text-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Summary</h2>
            <dl className="space-y-1.5">
              <Line label="Sub total" value={money(doc.subtotal)} />
              {doc.igst > 0 ? (
                <Line label="IGST" value={money(doc.igst)} />
              ) : (
                <>
                  <Line label="CGST" value={money(doc.cgst)} />
                  <Line label="SGST" value={money(doc.sgst)} />
                </>
              )}
              {doc.freight_amount > 0 && <Line label="Courier / freight" value={money(doc.freight_amount)} />}
              {doc.round_off !== 0 && <Line label="Round off" value={money(doc.round_off)} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                <dt>Grand total</dt>
                <dd className="tabular-nums">{money(doc.grand_total)}</dd>
              </div>
              {(doc.doc_type === "tax_invoice" || doc.doc_type === "proforma") && doc.status !== "draft" && (
                <>
                  <Line label="Paid" value={money(doc.amount_paid)} />
                  <div className={`flex justify-between font-bold ${doc.balance_due > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    <dt>Balance due</dt>
                    <dd className="tabular-nums">{money(doc.balance_due)}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Place of supply: {stateName(doc.place_of_supply_state_code) || "—"}</p>
              {doc.due_date && <p>Due: {date(doc.due_date)}</p>}
              {doc.valid_until && <p>Valid until: {date(doc.valid_until)}</p>}
              {doc.reference && <p>Reference: {doc.reference}</p>}
              {doc.cancel_reason && <p className="text-red-600">Cancelled: {doc.cancel_reason}</p>}
            </div>
          </div>

          {(related ?? []).length > 0 && (
            <div className="card card-pad text-sm">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Linked documents</h2>
              <ul className="space-y-1.5">
                {(related ?? []).map((r) => {
                  const rd = normalizeDoc(r);
                  return (
                    <li key={rd.id} className="flex justify-between gap-2">
                      <Link href={`/documents/${rd.id}`} className="text-brand-700 hover:underline">
                        {rd.converted_from_id === id ? "→ " : "← "}
                        {DOC_LABEL[rd.doc_type]} {rd.number ?? "(draft)"}
                      </Link>
                      <span className="tabular-nums text-slate-500">{money(rd.grand_total)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(payments ?? []).length > 0 && (
            <div className="card card-pad text-sm">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Payments</h2>
              <ul className="divide-y divide-slate-100">
                {(payments as Payment[]).map((pm) => (
                  <li key={pm.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <b className="tabular-nums">{money(pm.amount)}</b>
                      <span className="block text-xs text-slate-500">
                        {date(pm.paid_on)} · {PAYMENT_METHOD_LABEL[pm.method]}
                        {pm.reference ? ` · ${pm.reference}` : ""}
                      </span>
                    </span>
                    {ctx.role !== "viewer" && <DeletePaymentButton id={pm.id} />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card card-pad text-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">History</h2>
            <ul className="space-y-2">
              {(comms as Communication[] | null)?.map((c) => (
                <li key={c.id} className="flex gap-2">
                  {c.channel === "email" ? <Mail className="mt-0.5 size-4 text-slate-400" /> : <MessageCircle className="mt-0.5 size-4 text-[#25D366]" />}
                  <span>
                    <span className={c.status === "failed" ? "text-red-600" : ""}>
                      {c.channel === "email" ? "Email" : "WhatsApp"} {c.status === "failed" ? "failed" : ""} → {c.to_address || "—"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {c.subject} · {dateTime(c.created_at)}
                    </span>
                    {c.error && <span className="block text-xs text-red-600">{c.error}</span>}
                  </span>
                </li>
              ))}
              {(activity ?? []).map((a, i) => (
                <li key={i} className="text-xs text-slate-500">
                  • {String(a.action).replace(/_/g, " ")} · {dateTime(a.created_at)}
                </li>
              ))}
              {!comms?.length && !activity?.length && <li className="text-slate-400">Nothing yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd className="tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
