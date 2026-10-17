import type { Metadata } from "next";
import { NewDocument } from "@/lib/data/new-document";
import type { DocType } from "@/lib/types";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const search = await searchParams;
  const docType: DocType = search.type === "proforma" ? "proforma" : "tax_invoice";
  return <NewDocument docType={docType} search={search} backHref="/invoices" />;
}
