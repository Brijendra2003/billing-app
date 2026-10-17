import Link from "next/link";
import type { Metadata } from "next";
import { getContext } from "@/lib/auth";
import { normalizeDoc, displayStatus } from "@/lib/data/documents";
import { PageHeader, StatusBadge } from "@/components/ui";
import { date, money, todayIST } from "@/lib/format";
import { formatPhone } from "@/lib/india";
import { DOC_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const ctx = await getContext();
  const { q } = (await searchParams) as { q?: string };
  const term = (q ?? "").trim().replace(/[,()*%\\]/g, " ");
  const today = todayIST();

  const [clients, docs, products] = term
    ? await Promise.all([
        ctx.supabase
          .from("clients")
          .select("id, name, company_name, phone, city")
          .or(`name.ilike.*${term}*,company_name.ilike.*${term}*,phone.ilike.*${term}*,gstin.ilike.*${term}*,email.ilike.*${term}*`)
          .limit(10),
        ctx.supabase
          .from("documents")
          .select("id, doc_type, status, number, bill_to, issue_date, grand_total, due_date, valid_until, balance_due")
          .or(`number.ilike.*${term}*,bill_to->>name.ilike.*${term}*,reference.ilike.*${term}*`)
          .order("issue_date", { ascending: false })
          .limit(15),
        ctx.supabase.from("products").select("id, name, hsn_sac, default_rate").eq("is_archived", false).ilike("name", `%${term}%`).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const none = !clients.data?.length && !docs.data?.length && !products.data?.length;

  return (
    <div className="space-y-5">
      <PageHeader title={term ? `Results for “${term}”` : "Search"} />
      {term && none && <p className="text-slate-500">Nothing found.</p>}
      {!!clients.data?.length && (
        <section className="card card-pad">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Clients</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {clients.data.map((c) => (
              <li key={c.id} className="py-2">
                <Link href={`/clients/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                  {c.name}
                </Link>
                <span className="text-slate-500"> {[c.company_name, c.city, formatPhone(c.phone)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!docs.data?.length && (
        <section className="card card-pad">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Documents</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {docs.data.map((raw) => {
              const d = normalizeDoc(raw);
              return (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/documents/${d.id}`} className="font-semibold text-brand-700 hover:underline">
                      {DOC_LABEL[d.doc_type]} {d.number ?? "(draft)"}
                    </Link>
                    <span className="text-slate-500">
                      {" "}
                      {d.bill_to?.name} · {date(d.issue_date)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{money(d.grand_total)}</span>
                    <StatusBadge status={displayStatus(d, today)} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {!!products.data?.length && (
        <section className="card card-pad">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Products</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {products.data.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <Link href={`/products?edit=${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="tabular-nums text-slate-500">{money(p.default_rate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
