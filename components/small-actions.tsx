"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { Spinner } from "@/components/ui";
import { deletePayment, toggleFollowup, archiveProduct } from "@/app/actions/crm";
import { purgeClient, purgeDocument, restoreClient, restoreDocument, trashClient, trashDocument } from "@/app/actions/trash";

export function DeletePaymentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="text-slate-400 hover:text-red-600 disabled:opacity-50"
      disabled={pending}
      aria-label="Delete payment"
      onClick={() => {
        if (!confirm("Delete this payment? The invoice balance will be updated.")) return;
        start(async () => {
          await deletePayment(id);
          router.refresh();
        });
      }}
    >
      {pending ? <Spinner /> : <Trash2 className="size-4" />}
    </button>
  );
}

export function FollowupCheckbox({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (pending) return <Spinner className="mt-0.5 size-4 text-brand-600" />;
  return (
    <input
      type="checkbox"
      className="mt-0.5 size-4 accent-brand-600"
      checked={done}
      aria-label="Mark follow-up done"
      onChange={(e) =>
        start(async () => {
          await toggleFollowup(id, e.target.checked);
          router.refresh();
        })
      }
    />
  );
}

export function ArchiveProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm text-red-600"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this product from the list? Past documents are not affected.")) return;
        start(async () => {
          await archiveProduct(id);
          router.refresh();
        });
      }}
    >
      {pending && <Spinner className="size-3.5" />} Remove
    </button>
  );
}

/** Row-level delete on the quotation / invoice lists; stays on the list afterwards. */
export function DeleteDocumentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm px-2 text-slate-500 hover:text-red-600"
      disabled={pending}
      title="Delete"
      aria-label={`Delete ${label}`}
      onClick={() => {
        if (!confirm(`Delete ${label}? It moves to Trash with its payments, and you can restore it within 30 days.`)) return;
        start(async () => {
          const res = await trashDocument(id, true);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? <Spinner /> : <Trash2 className="size-4" />}
    </button>
  );
}

export function DeleteClientButton({
  id,
  name,
  counts,
  compact = false,
}: {
  id: string;
  name: string;
  /** Omitted on the client list, where the counts aren't loaded. */
  counts?: { quotations: number; invoices: number; payments: number };
  /** Icon-only button for table rows. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plural = (n: number, word: string) => (counts ? `${n} ${word}${n === 1 ? "" : "s"}` : `All ${word}s`);
  return (
    <>
      {compact ? (
        <button
          className="btn-ghost btn-sm px-2 text-slate-500 hover:text-red-600"
          title="Delete"
          aria-label={`Delete ${name}`}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <button className="btn-ghost btn-sm text-red-600" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Delete
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Delete client">
        <p className="text-sm text-slate-600">
          Delete <b>{name}</b> and everything linked to them?
        </p>
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          <li>{plural(counts?.quotations ?? 0, "quotation")}</li>
          <li>{plural(counts?.invoices ?? 0, "invoice")} (incl. credit notes)</li>
          <li>{plural(counts?.payments ?? 0, "payment")}</li>
          <li>Follow-ups and message history</li>
        </ul>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          These move to <b>Trash</b>. You can restore them within 30 days; after that they are deleted permanently.
        </p>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Keep
          </button>
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await trashClient(id);
                if (!res.ok) setError(res.error);
              })
            }
          >
            {pending ? <Spinner /> : <Trash2 className="size-4" />} Move to Trash
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Restore / Delete forever buttons for one row on the Trash page. */
export function TrashRowActions({ kind, id, label, canPurge }: { kind: "client" | "document"; id: string; label: string; canPurge: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"restore" | "purge" | null>(null);
  const run = (key: "restore" | "purge", fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    start(async () => {
      const res = await fn();
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  };
  return (
    <div className="flex justify-end gap-1">
      <button
        className="btn-ghost btn-sm"
        disabled={pending}
        onClick={() => run("restore", () => (kind === "client" ? restoreClient(id) : restoreDocument(id)))}
      >
        {pending && busy === "restore" ? <Spinner className="size-3.5" /> : <RotateCcw className="size-3.5" />} Restore
      </button>
      {canPurge && (
        <button
          className="btn-ghost btn-sm text-red-600"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
            run("purge", () => (kind === "client" ? purgeClient(id) : purgeDocument(id)));
          }}
        >
          {pending && busy === "purge" ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />} Delete forever
        </button>
      )}
    </div>
  );
}
