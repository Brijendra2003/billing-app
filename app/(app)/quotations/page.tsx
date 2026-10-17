import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/auth";
import { DocumentList, type ListFilters } from "@/components/document-list";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: PageProps<"/quotations">) {
  const ctx = await getContext();
  const filters = (await searchParams) as ListFilters;
  const newButton = (
    <Link href="/quotations/new" className="btn-primary">
      <Plus className="size-4" /> New quotation
    </Link>
  );
  return (
    <>
      <PageHeader title="Quotations" subtitle="Send quotations and convert accepted ones to invoices in one click." actions={newButton} />
      <DocumentList
        ctx={ctx}
        types={["quotation"]}
        filters={filters}
        basePath="/quotations"
        emptyAction={newButton}
        tabs={[
          { key: "", label: "All" },
          { key: "draft", label: "Drafts" },
          { key: "open", label: "Awaiting response" },
          { key: "accepted", label: "Accepted" },
          { key: "converted", label: "Converted" },
          { key: "cancelled", label: "Cancelled" },
        ]}
      />
    </>
  );
}
