"use client";

import { useActionState, useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { saveNumbering, savePreferences, saveProfile, saveTemplates, testGasConnection } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/auth";
import { STATES } from "@/lib/india";
import type { Business } from "@/lib/types";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.message) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

function Submit({ pending, label = "Save" }: { pending: boolean; label?: string }) {
  return (
    <button className="btn-primary" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />} {label}
    </button>
  );
}

function Input({ name, label, defaultValue, className, ...rest }: { name: string; label: string; defaultValue?: string | number; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      <input name={name} className="input" defaultValue={defaultValue} {...rest} />
    </label>
  );
}

function ImageField({ name, label, url }: { name: string; label: string; url: string | null }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">None</span>}
        </div>
        <div className="min-w-0 space-y-1">
          <input type="file" name={name} accept="image/png,image/jpeg" className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold" />
          {url && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" name={`remove_${name}`} /> Remove
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfileForm({ business, images }: { business: Business; images: { logo: string | null; signature: string | null; payment_qr: string | null } }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const localPhone = (p: string) => (p.startsWith("91") && p.length === 12 ? p.slice(2) : p);
  const phone = localPhone(business.phone);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Business name *" defaultValue={business.name} required className="sm:col-span-2" />
        <label className="block sm:col-span-2">
          <span className="label">Address</span>
          <textarea name="address" rows={2} className="input" defaultValue={business.address} />
        </label>
        <Input name="city" label="City" defaultValue={business.city} />
        <Input name="pincode" label="Pincode" defaultValue={business.pincode} />
        <label className="block">
          <span className="label">State</span>
          <select name="state_code" className="input" defaultValue={business.state_code}>
            <option value="">Select state</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <Input name="gstin" label="GSTIN" defaultValue={business.gstin} maxLength={15} />
        <Input name="pan" label="PAN" defaultValue={business.pan} maxLength={10} />
        <Input name="phone" label="Phone" defaultValue={phone} type="tel" />
        <Input name="email" label="Email (reply-to for emails)" defaultValue={business.email} type="email" />
        <Input name="website" label="Website" defaultValue={business.website} />
      </div>

      <h3 className="pt-2 text-sm font-bold text-slate-700">Bank & UPI</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="bank_account_name" label="Account name" defaultValue={business.bank_account_name} />
        <Input name="bank_account_no" label="Account number" defaultValue={business.bank_account_no} />
        <Input name="bank_ifsc" label="IFSC" defaultValue={business.bank_ifsc} />
        <Input name="bank_name" label="Bank" defaultValue={business.bank_name} />
        <Input name="bank_branch" label="Branch" defaultValue={business.bank_branch} />
        <Input name="upi_id" label="UPI ID (adds a pay-by-UPI QR with the amount)" defaultValue={business.upi_id} placeholder="name@bank" />
      </div>

      <h3 className="pt-2 text-sm font-bold text-slate-700">Accountant (CA)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="ca_name" label="CA name" defaultValue={business.ca_name ?? ""} />
        <Input name="ca_whatsapp" label="CA WhatsApp number (for “Share to CA” on Invoices)" defaultValue={localPhone(business.ca_whatsapp ?? "")} type="tel" />
      </div>

      <h3 className="pt-2 text-sm font-bold text-slate-700">Branding (PNG or JPG, up to 2 MB)</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <ImageField name="logo" label="Logo" url={images.logo} />
        <ImageField name="signature" label="Signature" url={images.signature} />
        <ImageField name="payment_qr" label="Payment QR (used if no UPI ID)" url={images.payment_qr} />
      </div>

      <Status state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function PreferencesForm({ business }: { business: Business }) {
  const [state, action, pending] = useActionState(savePreferences, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="default_tax_rate" label="Default GST %" defaultValue={business.default_tax_rate} inputMode="decimal" />
        <Input name="default_due_days" label="Invoice due in (days)" defaultValue={business.default_due_days} type="number" min={0} />
        <Input name="quotation_validity_days" label="Quotation valid for (days)" defaultValue={business.quotation_validity_days} type="number" min={1} />
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="round_off" defaultChecked={business.round_off} className="size-4 accent-brand-600" /> Round off grand total to the nearest rupee
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="freight_taxable" defaultChecked={business.freight_taxable} className="size-4 accent-brand-600" /> Charge GST on courier/freight by default
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="auto_backup_drive" defaultChecked={business.auto_backup_drive} className="size-4 accent-brand-600" /> Auto-save issued PDFs to Google Drive
        </label>
      </div>
      <label className="block">
        <span className="label">Invoice terms & conditions</span>
        <textarea name="default_terms" rows={3} className="input" defaultValue={business.default_terms} />
      </label>
      <label className="block">
        <span className="label">Quotation terms & conditions</span>
        <textarea name="quotation_terms" rows={3} className="input" defaultValue={business.quotation_terms} />
      </label>
      <Status state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function NumberingForm({ business, next }: { business: Business; next: Record<string, number> }) {
  const [state, action, pending] = useActionState(saveNumbering, undefined);
  const [format, setFormat] = useState(business.number_format);
  const [padding, setPadding] = useState(business.seq_padding);
  const preview = (prefix: string, seq: number) =>
    format.replace("{PREFIX}", prefix).replace("{FY}", "26-27").replace("{SEQ}", String(seq).padStart(padding, "0"));
  const types = [
    ["quotation", "Quotation", business.prefix_quotation],
    ["tax_invoice", "Tax invoice", business.prefix_tax_invoice],
    ["credit_note", "Credit note", business.prefix_credit_note],
  ] as const;

  return (
    <form action={action} className="space-y-4">
      {/* Proforma is no longer offered, but saveNumbering still requires its prefix */}
      <input type="hidden" name="prefix_proforma" value={business.prefix_proforma} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Format ({"{PREFIX}"} {"{FY}"} {"{SEQ}"})</span>
          <input name="number_format" className="input font-mono" value={format} onChange={(e) => setFormat(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Number digits</span>
          <input name="seq_padding" type="number" min={1} max={8} className="input" value={padding} onChange={(e) => setPadding(Number(e.target.value) || 1)} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="reset_yearly" defaultChecked={business.reset_yearly} className="size-4 accent-brand-600" /> Restart at 1 every April
        </label>
      </div>
      <p className="text-xs text-slate-500">
        To keep your old style (INV-101, INV-102…), use format <code className="font-mono">{"{PREFIX}-{SEQ}"}</code>, digits 1, untick &ldquo;Restart every
        April&rdquo;, and set the next tax invoice number to continue from your last one.
      </p>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Document</th>
              <th>Prefix</th>
              <th>Next number</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {types.map(([key, label, prefix]) => (
              <tr key={key}>
                <td className="whitespace-nowrap font-medium">{label}</td>
                <td>
                  <input name={`prefix_${key}`} defaultValue={prefix} className="input w-24" required />
                </td>
                <td>
                  <input name={`next_${key}`} type="number" min={1} placeholder={String(next[key] ?? 1)} className="input w-28" />
                </td>
                <td className="whitespace-nowrap font-mono text-xs text-slate-600">{preview(prefix, next[key] ?? 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Leave &ldquo;Next number&rdquo; blank to keep the current counter (shown greyed).</p>
      <Status state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function TemplatesForm({ business }: { business: Business }) {
  const [state, action, pending] = useActionState(saveTemplates, undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-xs text-slate-500">
        Placeholders: <code className="font-mono">{"{client_name} {doc_label} {number} {date} {amount} {balance} {due_date} {link} {business_name}"}</code>.
        WhatsApp supports *bold* and _italic_.
      </p>
      <Input name="email_subject_template" label="Email subject" defaultValue={business.email_subject_template} />
      <label className="block">
        <span className="label">Email message</span>
        <textarea name="email_body_template" rows={7} className="input" defaultValue={business.email_body_template} />
      </label>
      <label className="block">
        <span className="label">WhatsApp message</span>
        <textarea name="whatsapp_template" rows={6} className="input" defaultValue={business.whatsapp_template} />
      </label>
      <label className="block">
        <span className="label">WhatsApp payment reminder</span>
        <textarea name="reminder_template" rows={5} className="input" defaultValue={business.reminder_template} />
      </label>
      <Status state={state} />
      <Submit pending={pending} />
    </form>
  );
}

export function GasTest({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(testGasConnection, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-600">
        Status:{" "}
        {configured ? (
          <b className="text-emerald-700">URL and secret are set</b>
        ) : (
          <b className="text-amber-700">Not configured. Add GAS_WEBAPP_URL and GAS_SHARED_SECRET to the environment (see README)</b>
        )}
      </p>
      <Status state={state} />
      <button className="btn-secondary" disabled={pending || !configured}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Test connection
      </button>
    </form>
  );
}
