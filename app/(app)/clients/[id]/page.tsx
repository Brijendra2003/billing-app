import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, FileText, Mail, MessageCircle, Pencil, Phone, Receipt } from "lucide-react";
import { getContext } from "@/lib/auth";
import { displayStatus, normalizeDoc } from "@/lib/data/documents";
import { buildLedger } from "@/lib/ledger";
import { addFollowup, archiveClient } from "@/app/actions/crm";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";
import { DeleteClientButton, FollowupCheckbox } from "@/components/small-actions";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { date, dateTime, money, todayIST } from "@/lib/format";
import { formatPhone, stateName } from "@/lib/india";
import { DOC_LABEL, type Client, type Communication, type Followup } from "@/lib/types";

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const ctx = await getContext();
  const { id } = await params;
  const { tab } = (await searchParams) as { tab?: string };
  const { data } = await ctx.supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const client = data as Client;
  const today = todayIST();
  const canWrite = ctx.role !== "viewer";

  const [{ data: docsRaw }, { data: paymentsRaw }, { data: followups }, { data: comms }] = await Promise.all([
    ctx.supabase
      .from("documents")
      .select("id, doc_type, status, number, issue_date, due_date, valid_until, grand_total, balance_due, amount_paid")
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),
    ctx.supabase.from("payments").select("paid_on, amount, method, reference, document_id").eq("client_id", id),
    ctx.supabase.from("followups").select("*").eq("client_id", id).order("done").order("due_on"),
    ctx.supabase.from("communications").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  const docs = (docsRaw ?? []).map(normalizeDoc);
  const payments = (paymentsRaw ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
  const numbers = new Map(docs.map((d) => [d.id, d.number ?? ""]));

  const live = docs.filter((d) => !["draft", "cancelled"].includes(d.status));
  const billed =
    live.filter((d) => d.doc_type === "tax_invoice").reduce((s, d) => s + d.grand_total, 0) -
    live.filter((d) => d.doc_type === "credit_note").reduce((s, d) => s + d.grand_total, 0);
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = live
    .filter((d) => d.doc_type === "tax_invoice" && d.status !== "converted")
    .reduce((s, d) => s + d.balance_due, 0);
  const openQuotes = live.filter((d) => d.doc_type === "quotation" && ["issued", "sent"].includes(d.status)).length;

  const ledger = buildLedger({ openingBalance: Number(client.opening_balance), documents: docs, payments, docNumbers: numbers });
  const wa = client.whatsapp || client.phone;
  const current = tab === "ledger" || tab === "followups" ? tab : "documents";
  const addr = [client.address, client.city, stateName(client.state_code), client.pincode].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/clients", label: "Clients" }}
        title={client.name}
        subtitle={
          <>
            {client.company_name && <span className="font-medium text-slate-700">{client.company_name} · </span>}
            {addr || "No address"}
            {client.gstin && <span className="ml-1 font-mono text-xs">· GSTIN {client.gstin}</span>}
          </>
        }
        actions={
          <>
            <Link href={`/quotations/new?client=${client.id}`} className="btn-secondary">
              <FileText className="size-4" /> Quotation
            </Link>
            <Link href={`/invoices/new?client=${client.id}`} className="btn-primary">
              <Receipt className="size-4" /> Invoice
            </Link>
          </>
        }
      />

      <div className="no-print flex flex-wrap gap-2">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="btn-whatsapp btn-sm">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
        {client.phone && (
          <a href={`tel:+${client.phone}`} className="btn-secondary btn-sm">
            <Phone className="size-4" /> {formatPhone(client.phone)}
          </a>
        )}
        {client.email && (
          <a href={`mailto:${client.email}`} className="btn-secondary btn-sm">
            <Mail className="size-4" /> {client.email}
          </a>
        )}
        {canWrite && (
          <>
            <Link href={`/clients/${client.id}/edit`} className="btn-ghost btn-sm">
              <Pencil className="size-4" /> Edit
            </Link>
            <form action={archiveClient.bind(null, client.id, !client.is_archived)}>
              <SubmitButton className="btn-ghost btn-sm" icon={<Archive className="size-4" />}>
                {client.is_archived ? "Restore" : "Archive"}
              </SubmitButton>
            </form>
            <DeleteClientButton
              id={client.id}
              name={client.name}
              counts={{
                quotations: docs.filter((d) => d.doc_type === "quotation").length,
                invoices: docs.filter((d) => d.doc_type !== "quotation").length,
                payments: payments.length,
              }}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total billed" value={money(billed)} />
        <Stat label="Received" value={money(received)} tone="green" />
        <Stat label="Outstanding" value={money(outstanding)} tone={outstanding > 0 ? "red" : undefined} />
        <Stat label="Open quotations" value={openQuotes} />
      </div>

      {client.notes && <p className="card card-pad whitespace-pre-line text-sm text-slate-600">{client.notes}</p>}

      <div className="no-print flex gap-4 border-b border-slate-200 text-sm font-semibold">
        {[
          ["documents", "Documents"],
          ["ledger", "Ledger / statement"],
          ["followups", "Follow-ups & activity"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/clients/${client.id}${key === "documents" ? "" : `?tab=${key}`}`}
            className={`-mb-px border-b-2 px-1 pb-2 ${current === key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {current === "documents" && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Document</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="hidden text-right sm:table-cell">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documents/${d.id}`} className="font-semibold text-brand-700 hover:underline">
                      {d.number ?? "Draft"}
                    </Link>
                    <span className="block text-xs text-slate-500">{DOC_LABEL[d.doc_type]}</span>
                  </td>
                  <td className="whitespace-nowrap">{date(d.issue_date)}</td>
                  <td className="text-right tabular-nums">{money(d.grand_total)}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">
                    {d.doc_type === "tax_invoice" && d.status !== "draft" ? money(d.balance_due) : "—"}
                  </td>
                  <td>
                    <StatusBadge status={displayStatus(d, today)} />
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No documents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {current === "ledger" && (
        <div className="card card-pad print-full">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-bold">Statement of account</h2>
              <p className="text-sm text-slate-500">
                {ctx.business.name} → {client.name} · as of {date(today)}
              </p>
            </div>
            <PrintButton />
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{date(l.date)}</td>
                    <td>
                      {l.kind === "invoice" || l.kind === "credit_note" ? (
                        <Link href={`/documents/${l.docId}`} className="text-brand-700 hover:underline">
                          {l.kind === "invoice" ? "Invoice" : "Credit note"} {l.ref}
                        </Link>
                      ) : (
                        l.ref
                      )}
                    </td>
                    <td className="text-right tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                    <td className="text-right tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                    <td className="text-right font-medium tabular-nums">{money(l.balance)}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {ledger.length > 0 && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4} className="px-3 py-2 text-right">
                      Closing balance
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(ledger.at(-1)!.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {current === "followups" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card card-pad">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Follow-ups</h2>
            {canWrite && (
              <form action={addFollowup} className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input type="hidden" name="client_id" value={client.id} />
                <input name="note" required className="input" placeholder="e.g. Call about pending payment" />
                <input name="due_on" type="date" required className="input" defaultValue={today} />
                <SubmitButton>Add</SubmitButton>
              </form>
            )}
            <ul className="space-y-2">
              {((followups ?? []) as Followup[]).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <FollowupCheckbox id={f.id} done={f.done} />
                  <span className={f.done ? "text-slate-400 line-through" : ""}>
                    {f.note}
                    <span className={`block text-xs ${!f.done && f.due_on < today ? "text-red-600" : "text-slate-500"}`}>Due {date(f.due_on)}</span>
                  </span>
                </li>
              ))}
              {!followups?.length && <li className="text-sm text-slate-400">No follow-ups.</li>}
            </ul>
          </div>
          <div className="card card-pad">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Messages sent</h2>
            <ul className="space-y-2 text-sm">
              {((comms ?? []) as Communication[]).map((c) => (
                <li key={c.id} className="flex gap-2">
                  {c.channel === "email" ? <Mail className="mt-0.5 size-4 text-slate-400" /> : <MessageCircle className="mt-0.5 size-4 text-[#25D366]" />}
                  <span>
                    {c.subject}
                    {c.status === "failed" && <span className="text-red-600"> (failed)</span>}
                    <span className="block text-xs text-slate-500">
                      {c.to_address} · {dateTime(c.created_at)}
                    </span>
                  </span>
                </li>
              ))}
              {!comms?.length && <li className="text-slate-400">Nothing sent yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
