"use client";

import { AlertTriangle } from "lucide-react";

/** Shown when a page or an action on it fails, instead of a blank crash screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <h1 className="mt-3 font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-500">{error.message || "Please try again."}</p>
      <button className="btn-primary mt-5" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
