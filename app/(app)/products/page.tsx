import Link from "next/link";
import Form from "next/form";
import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { getContext } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";
import { ArchiveProductButton } from "@/components/small-actions";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const ctx = await getContext();
  const { q, edit } = (await searchParams) as { q?: string; edit?: string };
  let query = ctx.supabase.from("products").select("*").eq("is_archived", false).order("name").limit(1000);
  const term = q?.trim().replace(/[,()*%\\]/g, " ");
  if (term) query = query.or(`name.ilike.*${term}*,hsn_sac.ilike.*${term}*`);
  const { data } = await query;
  const products = (data ?? []).map((p) => ({ ...p, default_rate: Number(p.default_rate), tax_rate: Number(p.tax_rate) })) as Product[];
  const editing = edit ? products.find((p) => p.id === edit) : undefined;
  const taxRate = Number(ctx.business.default_tax_rate);
  const canWrite = ctx.role !== "viewer";

  return (
    <>
      <PageHeader title="Products & services" subtitle="New items typed on an invoice are added here automatically." />
      {canWrite && (
        <div className="card card-pad mb-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{editing ? `Edit ${editing.name}` : "Add product"}</h2>
          <ProductForm key={editing?.id ?? "new"} product={editing} defaultTaxRate={taxRate} />
        </div>
      )}
      <Form action="/products" className="mb-3 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or HSN…" className="input h-9 sm:w-64" />
        <SubmitButton className="btn-secondary btn-sm">Search</SubmitButton>
      </Form>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th className="hidden sm:table-cell">HSN/SAC</th>
              <th className="text-right">Rate</th>
              <th className="text-right">GST</th>
              <th className="w-36" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="font-medium">{p.name}</span>
                  {p.description && <span className="block text-xs text-slate-500">{p.description}</span>}
                </td>
                <td className="hidden font-mono text-xs sm:table-cell">{p.hsn_sac}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {money(p.default_rate)}
                  <span className="text-xs text-slate-500">/{p.pricing_mode === "area" ? "sq ft" : p.unit}</span>
                </td>
                <td className="text-right">{p.tax_rate}%</td>
                <td className="whitespace-nowrap text-right">
                  {canWrite && (
                    <>
                      <Link href={`/products?edit=${p.id}`} className="btn-ghost btn-sm" scroll>
                        Edit
                      </Link>
                      <ArchiveProductButton id={p.id} />
                    </>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
