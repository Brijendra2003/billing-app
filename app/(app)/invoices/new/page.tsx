import type { Metadata } from "next";
import { NewDocument } from "@/lib/data/new-document";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const search = await searchParams;
  return <NewDocument docType="tax_invoice" search={search} backHref="/invoices" />;
}
