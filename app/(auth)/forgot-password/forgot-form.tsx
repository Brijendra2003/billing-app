"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";

export function ForgotForm() {
  const expired = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("error") === "expired",
    () => false,
  );
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.message) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-emerald-500" />
        <p className="text-sm text-slate-600">{state.message}</p>
        <Link href="/login" className="btn-secondary w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {expired && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          That reset link is invalid or has expired. Request a new one below.
        </p>
      )}
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" required className="input" autoFocus />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Send reset link
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
