"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { saveClient } from "@/app/actions/crm";
import { STATES, stateCodeFromGstin } from "@/lib/india";
import type { Client } from "@/lib/types";

function StateSelect({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <select name={name} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select state</option>
      {STATES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name} ({s.code})
        </option>
      ))}
    </select>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  const [stateCode, setStateCode] = useState(client?.state_code ?? "");
  const [shipState, setShipState] = useState(client?.shipping_state_code ?? "");
  const [ship, setShip] = useState(Boolean(client?.shipping_address));
  const phoneDisplay = (p?: string) => (p && p.startsWith("91") && p.length === 12 ? p.slice(2) : (p ?? ""));

  return (
    <form action={action} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}
      <section className="card card-pad grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Client / contact name *</span>
          <input name="name" required className="input" defaultValue={client?.name} autoFocus={!client} />
        </label>
        <label className="block">
          <span className="label">Company name</span>
          <input name="company_name" className="input" defaultValue={client?.company_name} />
        </label>
        <label className="block">
          <span className="label">Mobile</span>
          <input name="phone" type="tel" className="input" defaultValue={phoneDisplay(client?.phone)} placeholder="98765 43210" />
        </label>
        <label className="block">
          <span className="label">WhatsApp (if different)</span>
          <input
            name="whatsapp"
            type="tel"
            className="input"
            defaultValue={client?.whatsapp !== client?.phone ? phoneDisplay(client?.whatsapp) : ""}
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" className="input" defaultValue={client?.email} />
        </label>
        <label className="block">
          <span className="label">GSTIN</span>
          <input
            name="gstin"
            maxLength={15}
            className="input uppercase"
            defaultValue={client?.gstin}
            onChange={(e) => {
              const code = stateCodeFromGstin(e.target.value);
              if (code) setStateCode(code);
            }}
          />
        </label>
      </section>

      <section className="card card-pad grid gap-3 sm:grid-cols-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">Billing address</h2>
        <label className="block sm:col-span-2">
          <span className="label">Address</span>
          <textarea name="address" rows={2} className="input" defaultValue={client?.address} />
        </label>
        <label className="block">
          <span className="label">City</span>
          <input name="city" className="input" defaultValue={client?.city} />
        </label>
        <label className="block">
          <span className="label">Pincode</span>
          <input name="pincode" inputMode="numeric" className="input" defaultValue={client?.pincode} />
        </label>
        <label className="block">
          <span className="label">State (decides IGST vs CGST + SGST)</span>
          <StateSelect name="state_code" value={stateCode} onChange={setStateCode} />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <input type="checkbox" className="size-4 accent-brand-600" checked={ship} onChange={(e) => setShip(e.target.checked)} />
          Different shipping address
        </label>
        {ship && (
          <>
            <label className="block">
              <span className="label">Shipping name</span>
              <input name="shipping_name" className="input" defaultValue={client?.shipping_name} />
            </label>
            <label className="block">
              <span className="label">Shipping city</span>
              <input name="shipping_city" className="input" defaultValue={client?.shipping_city} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Shipping address</span>
              <textarea name="shipping_address" rows={2} className="input" defaultValue={client?.shipping_address} />
            </label>
            <label className="block">
              <span className="label">Shipping pincode</span>
              <input name="shipping_pincode" className="input" defaultValue={client?.shipping_pincode} />
            </label>
            <label className="block">
              <span className="label">Shipping state</span>
              <StateSelect name="shipping_state_code" value={shipState} onChange={setShipState} />
            </label>
          </>
        )}
      </section>

      <section className="card card-pad grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Credit days</span>
          <input name="credit_days" type="number" min={0} className="input" defaultValue={client?.credit_days ?? 0} />
        </label>
        <label className="block">
          <span className="label">Opening balance (₹)</span>
          <input name="opening_balance" inputMode="decimal" className="input" defaultValue={client?.opening_balance ?? 0} />
        </label>
        <label className="block">
          <span className="label">Tags (comma separated)</span>
          <input name="tags" className="input" defaultValue={client?.tags?.join(", ")} placeholder="dealer, mumbai" />
        </label>
        <label className="block sm:col-span-3">
          <span className="label">Notes</span>
          <textarea name="notes" rows={3} className="input" defaultValue={client?.notes} />
        </label>
      </section>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} {client ? "Save changes" : "Add client"}
        </button>
      </div>
    </form>
  );
}
