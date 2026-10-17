"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { respondToQuotation } from "./actions";

export function QuoteResponse({ token }: { token: string }) {
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
        <Check className="size-4" />
        {done === "accepted" ? "Thank you! We've been notified that you accepted this quotation." : "Thanks for letting us know."}
      </p>
    );
  }

  const respond = (r: "accepted" | "rejected") =>
    start(async () => {
      if (await respondToQuotation(token, r)) setDone(r);
    });

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
      <p className="mr-2 text-sm text-slate-600">Happy with this quotation?</p>
      <button className="btn-primary" disabled={pending} onClick={() => respond("accepted")}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept quotation
      </button>
      <button className="btn-ghost" disabled={pending} onClick={() => respond("rejected")}>
        Decline
      </button>
    </div>
  );
}
