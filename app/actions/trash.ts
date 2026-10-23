"use server";

import { redirect } from "next/navigation";
import { assertCanWrite, assertOwner, getContext } from "@/lib/auth";
import type { ActionResult } from "@/app/actions/documents";
import type { DocType } from "@/lib/types";

// Trashing, restoring and purging all run in the database (supabase/migrations/0003_trash.sql)
// because trashed rows are invisible to normal queries.

async function call(fn: string, args: Record<string, string>, owner = false): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    if (owner) assertOwner(ctx);
    else assertCanWrite(ctx);
    const { error } = await ctx.supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Moves the client and all of its quotations, invoices and payments to the trash. */
export async function trashClient(id: string): Promise<ActionResult> {
  const res = await call("trash_client", { p_client: id });
  if (!res.ok) return res;
  redirect("/clients");
}

/** Moves one document (with its payments) to the trash, then goes back to its list unless `stay`. */
export async function trashDocument(id: string, stay = false): Promise<ActionResult> {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { ok: false, error: "You have read-only access." };
  const { data, error } = await ctx.supabase.rpc("trash_document", { p_document: id });
  if (error) return { ok: false, error: error.message };
  if (stay) return { ok: true };
  redirect((data as DocType) === "quotation" ? "/quotations" : "/invoices");
}

export async function restoreClient(id: string) {
  return call("restore_client", { p_client: id });
}

export async function restoreDocument(id: string) {
  return call("restore_document", { p_document: id });
}

export async function purgeClient(id: string) {
  return call("purge_client", { p_client: id }, true);
}

export async function purgeDocument(id: string) {
  return call("purge_document", { p_document: id }, true);
}
