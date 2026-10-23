import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDoc, normalizeItem } from "@/lib/data/documents";
import type { Business } from "@/lib/types";

/** Looks up a shared document by its unguessable token (bypasses RLS on purpose). */
export async function getSharedDocument(token: string) {
  if (!/^[a-f0-9]{32,128}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: doc } = await admin.from("documents").select("*").eq("share_token", token).is("deleted_at", null).maybeSingle();
  if (!doc || doc.status === "draft") return null;
  const [{ data: items }, { data: business }] = await Promise.all([
    admin.from("document_items").select("*").eq("document_id", doc.id).order("position"),
    admin.from("businesses").select("*").eq("id", doc.business_id).single(),
  ]);
  return {
    admin,
    doc: normalizeDoc(doc),
    items: (items ?? []).map(normalizeItem),
    business: business as Business,
  };
}
