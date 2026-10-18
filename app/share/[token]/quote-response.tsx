"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { respondToQuotation } from "./actions";

export function QuoteResponse({ token, expired }: { token: string; expired: boolean }) {
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
        <Check className="size-4" />
        {done === "accepted" ? "Thank you! We've been notified that you accepted this quotation." : "Thanks for letting us know."}
      </p>
    );
  }

  if (expired) {
    return (
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-orange-700">
        This quotation has expired. Please contact us for an updated quotation.
      </p>
    );
  }

  const respond = (r: "accepted" | "rejected") => {
    setChoice(r);
    setFailed(false);
    start(async () => {
      if (await respondToQuotation(token, r)) setDone(r);
      else setFailed(true);
    });
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm text-slate-600">Happy with this quotation?</p>
        <button className="btn-primary" disabled={pending} onClick={() => respond("accepted")}>
          {pending && choice === "accepted" ? <Spinner /> : <Check className="size-4" />} Accept quotation
        </button>
        <button className="btn-ghost" disabled={pending} onClick={() => respond("rejected")}>
          {pending && choice === "rejected" ? <Spinner /> : <X className="size-4" />} Decline
        </button>
      </div>
      {failed && <p className="mt-2 text-sm text-red-600">Couldn&apos;t record your response. Please refresh the page and try again.</p>}
    </div>
  );
}
