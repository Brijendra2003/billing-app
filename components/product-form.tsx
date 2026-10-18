"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { saveProduct } from "@/app/actions/crm";
import type { Product } from "@/lib/types";

export function ProductForm({ product, defaultTaxRate, onDone }: { product?: Product; defaultTaxRate: number; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      if (product) {
        // Leave edit mode (drops ?edit=…) so the form is ready for the next new product.
        if (onDone) onDone();
        else router.push("/products");
        return;
      }
      formRef.current?.reset();
      router.refresh();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid grid-cols-2 gap-3 md:grid-cols-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <label className="col-span-2 block">
        <span className="label">Name *</span>
        <input name="name" required className="input" defaultValue={product?.name} />
      </label>
      <label className="block">
        <span className="label">HSN/SAC</span>
        <input name="hsn_sac" className="input" defaultValue={product?.hsn_sac} />
      </label>
      <label className="block">
        <span className="label">Rate (₹)</span>
        <input name="default_rate" inputMode="decimal" required className="input" defaultValue={product?.default_rate ?? ""} />
      </label>
      <label className="block">
        <span className="label">GST %</span>
        <select name="tax_rate" className="input" defaultValue={String(product?.tax_rate ?? defaultTaxRate)}>
          {["0", "5", "12", "18", "28"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Unit</span>
        <input name="unit" className="input" defaultValue={product?.unit ?? "pcs"} />
      </label>
      <label className="col-span-2 block md:col-span-3">
        <span className="label">Description</span>
        <input name="description" className="input" defaultValue={product?.description} />
      </label>
      <label className="block md:col-span-2">
        <span className="label">Pricing</span>
        <select name="pricing_mode" className="input" defaultValue={product?.pricing_mode ?? "unit"}>
          <option value="unit">Per unit</option>
          <option value="area">Per sq ft (by size)</option>
        </select>
      </label>
      <div className="col-span-2 flex items-end gap-2 md:col-span-1">
        <button className="btn-primary w-full" disabled={pending}>
          {pending && <Spinner />} {product ? "Save" : "Add"}
        </button>
        {product && !onDone && (
          <Link href="/products" className="btn-ghost px-2" title="Cancel editing">
            Cancel
          </Link>
        )}
      </div>
      {state?.error && <p className="col-span-2 text-sm text-red-600 md:col-span-6">{state.error}</p>}
      {state?.message && !product && <p className="col-span-2 text-sm text-emerald-700 md:col-span-6">{state.message}</p>}
    </form>
  );
}
