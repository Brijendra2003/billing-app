import type { Metadata } from "next";
import { connection } from "next/server";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage() {
  await connection();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/clients", label: "Clients" }} title="Add client" />
      <ClientForm />
    </div>
  );
}
