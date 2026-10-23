import Link from "next/link";
import type { Metadata } from "next";
import { getContext } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { TrashRowActions } from "@/components/small-actions";
import { date, dateTime, money } from "@/lib/format";
import { DOC_LABEL, type DocType } from "@/lib/types";

export const metadata: Metadata = { title: "Trash" };

const KEEP_DAYS = 30;

interface TrashedClient {
  id: string;
  name: string;
  company_name: string;
  deleted_at: string;
  documents: number;
  payments: number;
}

interface TrashedDocument {
  id: string;
  doc_type: DocType;
  number: string | null;
  issue_date: string;
  grand_total: number;
  client_name: string | null;
  deleted_at: string;
  payments: number;
}

function daysLeft(deletedAt: string) {
  const ms = new Date(deletedAt).getTime() + KEEP_DAYS * 86_400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function DaysLeft({ deletedAt }: { deletedAt: string }) {
  const n = daysLeft(deletedAt);
  return (
    <span className={`whitespace-nowrap text-xs ${n <= 3 ? "font-semibold text-red-600" : "text-slate-500"}`}>
      {n === 0 ? "Today" : `${n} day${n === 1 ? "" : "s"}`}
    </span>
  );
}

export default async function TrashPage() {
  const ctx = await getContext();
  // Nothing schedules this by default, so expired items are cleared whenever the trash is opened.
  await ctx.supabase.rpc("purge_expired_trash");
  const { data } = await ctx.supabase.rpc("trash_list");
  const { clients = [], documents = [] } = (data ?? {}) as { clients?: TrashedClient[]; documents?: TrashedDocument[] };
  const canWrite = ctx.role !== "viewer";
  const canPurge = ctx.role === "owner";

  return (
    <>
      <PageHeader title="Trash" subtitle={`Deleted clients and documents are kept for ${KEEP_DAYS} days, then removed permanently.`} />

      {clients.length === 0 && documents.length === 0 ? (
        <EmptyState title="Trash is empty" body="Deleted clients, quotations and invoices show up here." />
      ) : (
        <div className="space-y-5">
          {clients.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-slate-500">Clients</h2>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="hidden sm:table-cell">Deleted</th>
                    <th>Removed in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="block text-xs text-slate-500">
                          {c.company_name && `${c.company_name} · `}
                          {c.documents} document{c.documents === 1 ? "" : "s"}, {c.payments} payment{c.payments === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap sm:table-cell">{dateTime(c.deleted_at)}</td>
                      <td>
                        <DaysLeft deletedAt={c.deleted_at} />
                      </td>
                      <td>{canWrite && <TrashRowActions kind="client" id={c.id} label={`${c.name} and all their documents and payments`} canPurge={canPurge} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {documents.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-slate-500">Quotations & invoices</h2>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th className="hidden sm:table-cell">Client</th>
                    <th className="text-right">Amount</th>
                    <th>Removed in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="font-semibold text-slate-800">{d.number ?? "Draft"}</span>
                        <span className="block text-xs text-slate-500">
                          {DOC_LABEL[d.doc_type]} · {date(d.issue_date)}
                          {d.payments > 0 && ` · ${d.payments} payment${d.payments === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">{d.client_name}</td>
                      <td className="text-right tabular-nums">{money(Number(d.grand_total))}</td>
                      <td>
                        <DaysLeft deletedAt={d.deleted_at} />
                      </td>
                      <td>
                        {canWrite && (
                          <TrashRowActions
                            kind="document"
                            id={d.id}
                            label={`${DOC_LABEL[d.doc_type].toLowerCase()} ${d.number ?? "(draft)"}`}
                            canPurge={canPurge}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Restoring a client brings back the documents and payments deleted with it. Looking for archived clients? See{" "}
            <Link href="/clients?filter=archived" className="text-brand-700 hover:underline">
              Clients → Archived
            </Link>
            .
          </p>
        </div>
      )}
    </>
  );
}
