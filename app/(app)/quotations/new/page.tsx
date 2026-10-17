import type { Metadata } from "next";
import { NewDocument } from "@/lib/data/new-document";

export const metadata: Metadata = { title: "New quotation" };

export default async function NewQuotationPage({ searchParams }: PageProps<"/quotations/new">) {
  return <NewDocument docType="quotation" search={await searchParams} backHref="/quotations" />;
}
