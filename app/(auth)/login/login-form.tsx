"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(e) => {
        // Read ?next= at submit time so the form can be prerendered as static HTML.
        const field = e.currentTarget.elements.namedItem("next") as HTMLInputElement;
        field.value = new URLSearchParams(window.location.search).get("next") ?? "";
      }}
    >
      <input type="hidden" name="next" />
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" required className="input" autoFocus />
      </label>
      <label className="block">
        <span className="flex items-center justify-between">
          <span className="label">Password</span>
          <Link href="/forgot-password" className="mb-1 text-xs font-semibold text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </span>
        <span className="relative block">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}
