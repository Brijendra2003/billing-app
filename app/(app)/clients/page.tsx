import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle, Plus } from "lucide-react";
import { getContext } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatPhone } from "@/lib/india";
import { money } from "@/lib/format";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const ctx = await getContext();
  const { q, filter } = (await searchParams) as { q?: string; filter?: string };

  let query = ctx.supabase.from("clients").select("*").eq("is_archived", filter === "archived").order("name").limit(500);
  const term = q?.trim().replace(/[,()*%\\]/g, " ");
  if (term) query = query.or(`name.ilike.*${term}*,company_name.ilike.*${term}*,phone.ilike.*${term}*,gstin.ilike.*${term}*,city.ilike.*${term}*`);

  const [{ data: clients }, { data: open }] = await Promise.all([
    query,
    ctx.supabase
      .from("documents")
      .select("client_id, balance_due")
      .eq("doc_type", "tax_invoice")
      .in("status", ["issued", "sent", "partially_paid"])
      .gt("balance_due", 0),
  ]);
  const outstanding = new Map<string, number>();
  for (const d of open ?? []) outstanding.set(d.client_id, (outstanding.get(d.client_id) ?? 0) + Number(d.balance_due));

  let list = (clients ?? []) as Client[];
  if (filter === "outstanding") list = list.filter((c) => (outstanding.get(c.id) ?? 0) > 0);

  const addButton = (
    <Link href="/clients/new" className="btn-primary">
      <Plus className="size-4" /> Add client
    </Link>
  );

  return (
    <>
      <PageHeader title="Clients" subtitle={`${list.length} client${list.length === 1 ? "" : "s"}`} actions={addButton} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {[
            ["", "All"],
            ["outstanding", "With dues"],
            ["archived", "Archived"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={key ? `/clients?filter=${key}` : "/clients"}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                (filter ?? "") === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <form action="/clients" className="flex gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Name, phone, GSTIN, city…" className="input h-9 sm:w-64" />
          <button className="btn-secondary btn-sm">Search</button>
        </form>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={q ? "No matching clients" : "No clients yet"}
          body="Clients are also added automatically when you type a new name on a quotation or invoice."
          action={addButton}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Client</th>
                <th className="hidden md:table-cell">Phone</th>
                <th className="hidden lg:table-cell">GSTIN</th>
                <th className="hidden sm:table-cell">City</th>
                <th className="text-right">Outstanding</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const due = outstanding.get(c.id) ?? 0;
                const wa = c.whatsapp || c.phone;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                      {c.company_name && <span className="block text-xs text-slate-500">{c.company_name}</span>}
                    </td>
                    <td className="hidden whitespace-nowrap md:table-cell">{formatPhone(c.phone)}</td>
                    <td className="hidden font-mono text-xs lg:table-cell">{c.gstin}</td>
                    <td className="hidden sm:table-cell">{c.city}</td>
                    <td className={`whitespace-nowrap text-right tabular-nums ${due > 0 ? "font-semibold text-red-600" : "text-slate-400"}`}>
                      {due > 0 ? money(due) : "—"}
                    </td>
                    <td>
                      {wa && (
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" aria-label={`WhatsApp ${c.name}`} className="text-[#25D366]">
                          <MessageCircle className="size-4.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
