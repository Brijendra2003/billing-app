import Link from "next/link";
import Form from "next/form";
import { FileDown, Pencil } from "lucide-react";
import type { AppContext } from "@/lib/auth";
import { displayStatus, isEditable, normalizeDoc } from "@/lib/data/documents";
import { date, money, todayIST } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { DeleteDocumentButton } from "@/components/small-actions";
import { DOC_LABEL, type DocType } from "@/lib/types";

export interface ListFilters {
  status?: string;
  q?: string;
  type?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export async function DocumentList({
  ctx,
  types,
  filters,
  basePath,
  tabs,
  emptyAction,
}: {
  ctx: AppContext;
  types: DocType[];
  filters: ListFilters;
  basePath: string;
  tabs: { key: string; label: string }[];
  emptyAction: React.ReactNode;
}) {
  const today = todayIST();
  const page = Math.max(1, Number(filters.page) || 1);
  const docTypes = filters.type && types.includes(filters.type as DocType) ? [filters.type as DocType] : types;

  let query = ctx.supabase
    .from("documents")
    .select("id, doc_type, status, number, issue_date, due_date, valid_until, bill_to, grand_total, balance_due, amount_paid", {
      count: "exact",
    })
    .in("doc_type", docTypes)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  switch (filters.status) {
    case "draft":
      query = query.eq("status", "draft");
      break;
    case "open":
      query = query.in("status", ["issued", "sent"]);
      break;
    // Credit notes carry a balance but are never "paid", so keep them out of the receivable tabs.
    case "unpaid":
      query = query.in("status", ["issued", "sent", "partially_paid"]).neq("doc_type", "credit_note").gt("balance_due", 0);
      break;
    case "overdue":
      query = query
        .in("status", ["issued", "sent", "partially_paid"])
        .eq("doc_type", "tax_invoice")
        .gt("balance_due", 0)
        .lt("due_date", today);
      break;
    case "paid":
      query = query.eq("status", "paid");
      break;
    case "accepted":
      query = query.eq("status", "accepted");
      break;
    case "converted":
      query = query.eq("status", "converted");
      break;
    case "cancelled":
      query = query.eq("status", "cancelled");
      break;
  }
  const q = filters.q?.trim();
  if (q) {
    const safe = q.replace(/[,()*%\\]/g, " ");
    query = query.or(`number.ilike.*${safe}*,bill_to->>name.ilike.*${safe}*`);
  }

  const { data, count } = await query;
  const docs = (data ?? []).map(normalizeDoc);
  const canWrite = ctx.role !== "viewer";

  const href = (patch: Partial<ListFilters>) => {
    const p = new URLSearchParams();
    const merged = { ...filters, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => {
            const active = (filters.status ?? "") === t.key;
            return (
              <Link
                key={t.key}
                href={href({ status: t.key || undefined, page: undefined })}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Form className="flex gap-2" action={basePath}>
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          {filters.type && <input type="hidden" name="type" value={filters.type} />}
          <input name="q" defaultValue={q} placeholder="Number or client…" className="input h-9 w-full sm:w-56" />
          <SubmitButton className="btn-secondary btn-sm">Search</SubmitButton>
        </Form>
      </div>

      {docs.length === 0 ? (
        <EmptyState title="Nothing here yet" body={q ? "No documents match your search." : undefined} action={emptyAction} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th className="hidden sm:table-cell">Date</th>
                <th className="hidden md:table-cell">{types.includes("quotation") ? "Valid until" : "Due"}</th>
                <th className="text-right">Amount</th>
                <th className="hidden text-right md:table-cell">Balance</th>
                <th>Status</th>
                <th className="w-32 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="cursor-pointer">
                  <td className="whitespace-nowrap">
                    <Link href={`/documents/${d.id}`} className="font-semibold text-brand-700 hover:underline">
                      {d.number ?? "Draft"}
                    </Link>
                    {types.length > 1 && <span className="block text-xs text-slate-500">{DOC_LABEL[d.doc_type]}</span>}
                  </td>
                  <td className="max-w-48 truncate">{d.bill_to?.name}</td>
                  <td className="hidden whitespace-nowrap sm:table-cell">{date(d.issue_date)}</td>
                  <td className="hidden whitespace-nowrap md:table-cell">{date(d.doc_type === "quotation" ? d.valid_until : d.due_date)}</td>
                  <td className="whitespace-nowrap text-right font-medium tabular-nums">{money(d.grand_total)}</td>
                  <td className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">
                    {d.doc_type === "quotation" || d.doc_type === "credit_note" || d.status === "draft" ? "—" : money(d.balance_due)}
                  </td>
                  <td>
                    <StatusBadge status={displayStatus(d, today)} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="inline-flex gap-0.5">
                      {canWrite && isEditable(d) && (
                        <Link href={`/documents/${d.id}/edit`} className="btn-ghost btn-sm px-2" title="Edit" aria-label={`Edit ${d.number ?? "draft"}`}>
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      <a
                        href={`/api/documents/${d.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="btn-ghost btn-sm px-2"
                        title="Open PDF"
                        aria-label={`Open PDF of ${d.number ?? "draft"}`}
                      >
                        <FileDown className="size-4" />
                      </a>
                      {canWrite && (
                        <DeleteDocumentButton id={d.id} label={`${DOC_LABEL[d.doc_type].toLowerCase()} ${d.number ?? "(draft)"}`} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(count ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {Math.ceil((count ?? 0) / PAGE_SIZE)}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="btn-secondary btn-sm" href={href({ page: String(page - 1) })}>
                Previous
              </Link>
            )}
            {page * PAGE_SIZE < (count ?? 0) && (
              <Link className="btn-secondary btn-sm" href={href({ page: String(page + 1) })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
