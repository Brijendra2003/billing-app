import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import type { Client } from "@/lib/types";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const ctx = await getContext();
  const { id } = await params;
  const { data } = await ctx.supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const client = data as Client;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: `/clients/${id}`, label: client.name }} title="Edit client" />
      <ClientForm client={client} />
    </div>
  );
}
