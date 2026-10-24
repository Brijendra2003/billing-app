import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Business, MemberRole } from "@/lib/types";

export interface AppContext {
  userId: string;
  email: string;
  role: MemberRole;
  business: Business;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Data Access Layer entry point. Verifies the session, loads the user's business,
 * and bootstraps the business for the very first admin. Cached per request.
 */
export const getContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  // getClaims() reads the clock to check token expiry, so it must only run for a real request,
  // never while prerendering or runtime-prefetching (io() still lets prefetches through).
  await connection();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect("/login");

  const load = () =>
    supabase.from("members").select("role, businesses(*)").eq("user_id", claims.sub).limit(1).maybeSingle();

  let { data: member } = await load();
  if (!member) {
    const { data: bid } = await supabase.rpc("bootstrap_business");
    if (!bid) redirect("/no-access");
    ({ data: member } = await load());
    if (!member) redirect("/no-access");
  }

  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    role: member.role as MemberRole,
    business: member.businesses as unknown as Business,
    supabase,
  };
});

export function assertCanWrite(ctx: AppContext) {
  if (ctx.role === "viewer") throw new Error("You have read-only access.");
}

export function assertOwner(ctx: AppContext) {
  if (ctx.role !== "owner") throw new Error("Only the owner can do this.");
}
