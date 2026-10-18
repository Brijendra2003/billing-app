"use server";

import { getSharedDocument } from "@/lib/data/share";
import { todayIST } from "@/lib/format";

/** Lets the client accept or decline a quotation from the public share page. */
export async function respondToQuotation(token: string, response: "accepted" | "rejected"): Promise<boolean> {
  if (response !== "accepted" && response !== "rejected") return false;
  const shared = await getSharedDocument(token);
  if (!shared || shared.doc.doc_type !== "quotation" || !["issued", "sent"].includes(shared.doc.status)) return false;
  // An expired quotation can't be accepted any more (declining is still fine).
  if (response === "accepted" && shared.doc.valid_until && shared.doc.valid_until < todayIST()) return false;

  const { admin, doc } = shared;
  const { error } = await admin.from("documents").update({ status: response }).eq("id", doc.id);
  if (error) return false;
  await admin.from("activity_log").insert({
    business_id: doc.business_id,
    actor_id: null,
    entity: "document",
    entity_id: doc.id,
    action: `client_${response}`,
    details: { via: "share_link" },
  });
  return true;
}
