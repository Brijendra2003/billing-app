"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui";
import { deletePayment, toggleFollowup, archiveProduct } from "@/app/actions/crm";

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
