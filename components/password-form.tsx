"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updatePassword } from "@/app/actions/auth";

export function PasswordForm({ from }: { from?: "settings" }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      {from && <input type="hidden" name="from" value={from} />}
      <label className="block">
        <span className="label">New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </label>
      <label className="block">
        <span className="label">Confirm new password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Update password
      </button>
    </form>
  );
}
