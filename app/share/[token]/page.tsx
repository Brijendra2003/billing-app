import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, FileText, IndianRupee } from "lucide-react";
import { getSharedDocument } from "@/lib/data/share";
import { money, date, todayIST } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { DOC_LABEL } from "@/lib/types";
import { upiUrl } from "@/lib/messaging/templates";
import { QuoteResponse } from "./quote-response";

export const metadata: Metadata = { title: "Document", robots: { index: false, follow: false } };

async function SharedDocument({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedDocument(token);
  if (!shared) notFound();
  const { doc, business } = shared;
  const label = DOC_LABEL[doc.doc_type];
  const payable = ["tax_invoice", "proforma"].includes(doc.doc_type) && doc.balance_due > 0 && doc.status !== "cancelled";
  const pdfUrl = `/api/share/${token}/pdf`;
  const expired = doc.doc_type === "quotation" && Boolean(doc.valid_until && doc.valid_until < todayIST());

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card card-pad">
        <p className="text-sm font-semibold text-brand-700">{business.name}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {label} {doc.number}
            </h1>
            <p className="text-sm text-slate-500">
              For {doc.bill_to.name} · {date(doc.issue_date)}
              {doc.doc_type === "quotation" && doc.valid_until ? ` · Valid until ${date(doc.valid_until)}` : ""}
              {doc.doc_type === "tax_invoice" && doc.due_date ? ` · Due ${date(doc.due_date)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{payable && doc.amount_paid > 0 ? "Balance due" : "Total"}</p>
            <p className="text-2xl font-bold tabular-nums">{money(payable ? doc.balance_due : doc.grand_total)}</p>
          </div>
        </div>
        {doc.status === "cancelled" && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This document has been cancelled.</p>
        )}
        {doc.status === "paid" && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> Paid in full. Thank you!
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`${pdfUrl}?download=1`} className="btn-primary">
            <Download className="size-4" /> Download PDF
          </a>
          <a href={pdfUrl} target="_blank" rel="noopener" className="btn-secondary">
            <FileText className="size-4" /> Open PDF
          </a>
          {payable && business.upi_id && (
            <a href={upiUrl(business.upi_id, business.name, doc.balance_due, doc.number ?? undefined)} className="btn-secondary">
              <IndianRupee className="size-4" /> Pay {money(doc.balance_due)} via UPI
            </a>
          )}
        </div>
        {doc.doc_type === "quotation" && ["issued", "sent"].includes(doc.status) && <QuoteResponse token={token} expired={expired} />}
        {doc.doc_type === "quotation" && doc.status === "accepted" && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-4" /> You accepted this quotation.
          </p>
        )}
        {doc.doc_type === "quotation" && doc.status === "rejected" && (
          <p className="mt-4 text-sm font-medium text-slate-600">You declined this quotation. Contact us if you&apos;d like a revised one.</p>
        )}
      </div>

      <div className="card relative hidden overflow-hidden md:block">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-600">
          <Spinner className="size-8 border-[3px]" />
          <span className="text-sm text-slate-500">Loading PDF…</span>
        </div>
        <iframe src={pdfUrl} title={`${label} ${doc.number}`} className="relative h-[80vh] w-full" />
      </div>

      <p className="text-center text-xs text-slate-400">
        {business.name}
        {business.phone ? ` · +${business.phone}` : ""}
        {business.email ? ` · ${business.email}` : ""}
      </p>
    </div>
  );
}

export default function SharePage({ params }: PageProps<"/share/[token]">) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center text-brand-600">
            <Spinner className="size-10 border-[3px]" />
          </div>
        }
      >
        <SharedDocument params={params} />
      </Suspense>
    </main>
  );
}
