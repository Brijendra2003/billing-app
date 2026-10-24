import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/auth";
import { DocumentList, type ListFilters } from "@/components/document-list";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Invoices" };

const TYPES = [
  { key: "", label: "All types" },
  { key: "tax_invoice", label: "Tax invoices" },
  { key: "credit_note", label: "Credit notes" },
];

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await getContext();
  const filters = (await searchParams) as ListFilters;
  const newButton = (
    <Link href="/invoices/new" className="btn-primary">
      <Plus className="size-4" /> New invoice
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Tax invoices and credit notes."
        actions={newButton}
      />
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        {TYPES.map((t) => {
          const active = (filters.type ?? "") === t.key;
          const p = new URLSearchParams();
          if (t.key) p.set("type", t.key);
          if (filters.status) p.set("status", filters.status);
          return (
            <Link
              key={t.key}
              href={`/invoices${p.size ? `?${p}` : ""}`}
              className={active ? "font-semibold text-brand-700 underline underline-offset-4" : "text-slate-500 hover:text-slate-800"}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <DocumentList
        ctx={ctx}
        types={["tax_invoice", "credit_note"]}
        filters={filters}
        basePath="/invoices"
        emptyAction={newButton}
        tabs={[
          { key: "", label: "All" },
          { key: "draft", label: "Drafts" },
          { key: "unpaid", label: "Unpaid" },
          { key: "overdue", label: "Overdue" },
          { key: "paid", label: "Paid" },
          { key: "cancelled", label: "Cancelled" },
        ]}
      />
    </>
  );
}
