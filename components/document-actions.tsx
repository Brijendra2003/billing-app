"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Copy,
  CopyPlus,
  Download,
  FileCheck2,
  FileMinus,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/modal";
import {
  cancelDocument,
  copyDocument,
  deleteDraft,
  issueDocument,
  logWhatsapp,
  regenerateShareLink,
  sendDocumentEmail,
  setQuotationStatus,
} from "@/app/actions/documents";
import { recordPayment } from "@/app/actions/crm";
import { whatsappUrl } from "@/lib/messaging/templates";
import { money } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type DocType, type DocStatus, type PaymentMethod } from "@/lib/types";

export interface DocActionProps {
  id: string;
  docType: DocType;
  status: DocStatus;
  number: string | null;
  balanceDue: number;
  editable: boolean;
  clientEmail: string;
  clientPhone: string;
  fileName: string;
  today: string;
  autoBackup: boolean;
  gasReady: boolean;
  messages: { link: string; emailSubject: string; emailBody: string; whatsapp: string; reminder: string };
}

export function DocumentActions(p: DocActionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<null | "email" | "whatsapp" | "payment" | "cancel">(null);
  const [flash, setFlash] = useState<string | null>(null);
  const isDraft = p.status === "draft";
  const isQuote = p.docType === "quotation";
  const isInvoice = p.docType === "tax_invoice";
  const canPay = (isInvoice || p.docType === "proforma") && !isDraft && p.status !== "cancelled" && p.status !== "converted" && p.balanceDue > 0;
  const pdfUrl = `/api/documents/${p.id}/pdf`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res && !res.ok) setFlash(res.error ?? "Something went wrong");
      else {
        if (ok) setFlash(ok);
        router.refresh();
      }
    });

  return (
    <>
      {flash && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-xs">
          <span>{flash}</span>
          <button className="text-slate-400" onClick={() => setFlash(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <button className="btn-primary" disabled={pending} onClick={() => run(() => issueDocument(p.id), "Issued.")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Issue
          </button>
        ) : (
          <>
            <button className="btn-whatsapp" onClick={() => setModal("whatsapp")}>
              <MessageCircle className="size-4" /> WhatsApp
            </button>
            <button className="btn-primary" onClick={() => setModal("email")}>
              <Mail className="size-4" /> Email
            </button>
          </>
        )}
        <a href={pdfUrl} target="_blank" rel="noopener" className="btn-secondary">
          <Printer className="size-4" /> Print
        </a>
        <a href={`${pdfUrl}?download=1`} className="btn-secondary">
          <Download className="size-4" /> PDF
        </a>
        {canPay && (
          <button className="btn-secondary" onClick={() => setModal("payment")}>
            <Wallet className="size-4" /> Record payment
          </button>
        )}
        {p.editable && (
          <Link href={`/documents/${p.id}/edit`} className="btn-secondary">
            <Pencil className="size-4" /> Edit
          </Link>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {isQuote && !isDraft && !["converted", "cancelled"].includes(p.status) && (
          <>
            {p.status !== "accepted" && (
              <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setQuotationStatus(p.id, "accepted"))}>
                <CheckCircle2 className="size-3.5" /> Mark accepted
              </button>
            )}
            {p.status !== "rejected" && (
              <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setQuotationStatus(p.id, "rejected"))}>
                <XCircle className="size-3.5" /> Mark rejected
              </button>
            )}
            <button className="btn-ghost btn-sm text-brand-700" disabled={pending} onClick={() => start(() => copyDocument(p.id, "convert", "tax_invoice"))}>
              <FileCheck2 className="size-3.5" /> Convert to invoice
            </button>
            <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(() => copyDocument(p.id, "convert", "proforma"))}>
              Convert to proforma
            </button>
          </>
        )}
        {p.docType === "proforma" && !isDraft && !["converted", "cancelled"].includes(p.status) && (
          <button className="btn-ghost btn-sm text-brand-700" disabled={pending} onClick={() => start(() => copyDocument(p.id, "convert", "tax_invoice"))}>
            <FileCheck2 className="size-3.5" /> Convert to tax invoice
          </button>
        )}
        {isInvoice && !isDraft && p.status !== "cancelled" && (
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(() => copyDocument(p.id, "credit_note"))}>
            <FileMinus className="size-3.5" /> Credit note
          </button>
        )}
        <button className="btn-ghost btn-sm" disabled={pending} onClick={() => start(() => copyDocument(p.id, "duplicate"))}>
          <CopyPlus className="size-3.5" /> Duplicate
        </button>
        {!isDraft && (
          <>
            <button
              className="btn-ghost btn-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(p.messages.link);
                setFlash("Share link copied.");
              }}
            >
              <Link2 className="size-3.5" /> Copy link
            </button>
            <button
              className="btn-ghost btn-sm"
              disabled={pending}
              onClick={() => {
                if (confirm("Create a new share link? The old link will stop working.")) run(() => regenerateShareLink(p.id), "New share link created.");
              }}
            >
              <RefreshCw className="size-3.5" /> Reset link
            </button>
          </>
        )}
        {!isDraft && p.status !== "cancelled" && (
          <button className="btn-ghost btn-sm text-red-600" onClick={() => setModal("cancel")}>
            <Ban className="size-3.5" /> Cancel
          </button>
        )}
        {isDraft && (
          <button
            className="btn-ghost btn-sm text-red-600"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft?")) start(() => deleteDraft(p.id));
            }}
          >
            <Trash2 className="size-3.5" /> Delete draft
          </button>
        )}
      </div>

      <EmailModal {...p} open={modal === "email"} onClose={() => setModal(null)} onSent={(m) => { setFlash(m); router.refresh(); }} />
      <WhatsAppModal {...p} open={modal === "whatsapp"} onClose={() => setModal(null)} />
      <PaymentModal {...p} open={modal === "payment"} onClose={() => setModal(null)} onSaved={() => router.refresh()} />
      <CancelModal id={p.id} open={modal === "cancel"} onClose={() => setModal(null)} onDone={() => router.refresh()} />
    </>
  );
}

function EmailModal(p: DocActionProps & { open: boolean; onClose: () => void; onSent: (msg: string) => void }) {
  const [to, setTo] = useState(p.clientEmail);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(p.messages.emailSubject);
  const [body, setBody] = useState(p.messages.emailBody);
  const [backup, setBackup] = useState(p.autoBackup);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Modal open={p.open} onClose={p.onClose} title="Send by email" wide>
      {!p.gasReady && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Email isn&apos;t configured yet. Set GAS_WEBAPP_URL and GAS_SHARED_SECRET (see README → Email).
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await sendDocumentEmail(p.id, { to, cc, subject, body, backup });
            if (!res.ok) setError(res.error);
            else {
              p.onClose();
              p.onSent(`Email sent to ${to} with ${p.fileName} attached.`);
            }
          });
        }}
      >
        <label className="block">
          <span className="label">To</span>
          <input className="input" type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">CC (optional, comma separated)</span>
          <input className="input" value={cc} onChange={(e) => setCc(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Subject</span>
          <input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Message</span>
          <textarea className="input" rows={8} required value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">📎 {p.fileName} will be attached automatically.</p>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="size-4 accent-brand-600" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
          Also save the PDF to Google Drive
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={p.onClose}>
            Close
          </button>
          <button className="btn-primary" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send email
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WhatsAppModal(p: DocActionProps & { open: boolean; onClose: () => void }) {
  const overdueish = p.docType === "tax_invoice" && p.balanceDue > 0;
  const [phone, setPhone] = useState(p.clientPhone);
  const [kind, setKind] = useState<"document" | "reminder">("document");
  const [message, setMessage] = useState(p.messages.whatsapp);
  const [file, setFile] = useState<File | null>(null);
  const [canShareFile, setCanShareFile] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Pre-fetch the PDF so the share sheet can open instantly (browsers require a fresh tap).
  useEffect(() => {
    if (!p.open || file) return;
    if (typeof navigator === "undefined" || !navigator.canShare) return;
    let cancelled = false;
    fetch(`/api/documents/${p.id}/pdf`)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        const f = new File([blob], p.fileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [f] })) {
          setFile(f);
          setCanShareFile(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [p.open, p.id, p.fileName, file]);

  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  const url = normalized ? whatsappUrl(normalized, message) : "";

  return (
    <Modal open={p.open} onClose={p.onClose} title="Send on WhatsApp" wide>
      <div className="space-y-3">
        {overdueish && (
          <div className="flex gap-2 text-sm">
            <button
              className={kind === "document" ? "btn-dark btn-sm" : "btn-secondary btn-sm"}
              onClick={() => {
                setKind("document");
                setMessage(p.messages.whatsapp);
              }}
            >
              Send invoice
            </button>
            <button
              className={kind === "reminder" ? "btn-dark btn-sm" : "btn-secondary btn-sm"}
              onClick={() => {
                setKind("reminder");
                setMessage(p.messages.reminder);
              }}
            >
              Payment reminder
            </button>
          </div>
        )}
        <label className="block">
          <span className="label">Client WhatsApp number</span>
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
        </label>
        <label className="block">
          <span className="label">Message (includes a secure link to the PDF)</span>
          <textarea className="input" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={url || undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={!url}
            className={`btn-whatsapp py-3 ${url ? "" : "pointer-events-none opacity-50"}`}
            onClick={() => {
              void logWhatsapp(p.id, normalized, message, kind);
            }}
          >
            <MessageCircle className="size-4" /> Open client&apos;s chat
          </a>
          <button
            className="btn-secondary py-3"
            disabled={!canShareFile}
            title={canShareFile ? "" : "Sharing files works on phones (Android Chrome / iPhone Safari)"}
            onClick={async () => {
              if (!file) return;
              try {
                await navigator.share({ files: [file], text: message });
                void logWhatsapp(p.id, normalized, message, "file");
                setNote("Shared.");
              } catch {
                /* user dismissed the share sheet */
              }
            }}
          >
            <Share2 className="size-4" /> Share PDF file
          </button>
        </div>
        <p className="text-xs text-slate-500">
          <b>Open client&apos;s chat</b> opens WhatsApp straight to this client with the message ready. The PDF goes as a link they can tap.{" "}
          <b>Share PDF file</b> (on your phone) attaches the actual PDF; pick WhatsApp, then the client.
        </p>
        {note && <p className="text-sm text-emerald-700">{note}</p>}
        <button
          className="btn-ghost btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setNote("Message copied.");
          }}
        >
          <Copy className="size-3.5" /> Copy message
        </button>
      </div>
    </Modal>
  );
}

function PaymentModal(p: DocActionProps & { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  useEffect(() => {
    if (state?.message) {
      p.onSaved();
      p.onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open={p.open} onClose={p.onClose} title={`Record payment · ${p.number ?? ""}`}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="document_id" value={p.id} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Amount (balance {money(p.balanceDue)})</span>
            <input className="input" name="amount" inputMode="decimal" required defaultValue={p.balanceDue.toFixed(2)} />
          </label>
          <label className="block">
            <span className="label">Date</span>
            <input className="input" type="date" name="paid_on" required defaultValue={p.today} />
          </label>
        </div>
        <label className="block">
          <span className="label">Method</span>
          <select className="input" name="method" defaultValue="upi">
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Reference (UTR / cheque no.)</span>
          <input className="input" name="reference" />
        </label>
        <label className="block">
          <span className="label">Notes</span>
          <input className="input" name="notes" />
        </label>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={p.onClose}>
            Close
          </button>
          <button className="btn-primary" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Save payment
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CancelModal({ id, open, onClose, onDone }: { id: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Cancel document">
      <p className="mb-3 text-sm text-slate-600">
        The number is kept and the PDF will show <b>CANCELLED</b>. Cancelled invoices are excluded from sales reports.
      </p>
      <label className="block">
        <span className="label">Reason</span>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong GSTIN, re-issued as INV/…" />
      </label>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Keep
        </button>
        <button
          className="btn-danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelDocument(id, reason);
              if (!res.ok) setError(res.error);
              else {
                onClose();
                onDone();
              }
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Cancel document
        </button>
      </div>
    </Modal>
  );
}
