import Link from "next/link";
import type { Metadata } from "next";
import { getContext } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { GasTest, NumberingForm, PreferencesForm, ProfileForm, TemplatesForm } from "@/components/settings-forms";
import { PasswordForm } from "@/components/password-form";
import { gasConfigured } from "@/lib/messaging/gas";
import { financialYear } from "@/lib/india";
import { todayIST } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  ["business", "Business"],
  ["preferences", "Invoice defaults"],
  ["numbering", "Numbering"],
  ["templates", "Messages"],
  ["email", "Email & Drive"],
  ["account", "Account"],
] as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const ctx = await getContext();
  const { tab: t } = (await searchParams) as { tab?: string };
  const tab = TABS.some(([k]) => k === t) ? t! : "business";
  const b = ctx.business;
  const isOwner = ctx.role === "owner";

  let content: React.ReactNode = null;
  if (!isOwner && tab !== "account") {
    content = <p className="text-sm text-slate-500">Only the owner can change business settings.</p>;
  } else if (tab === "business") {
    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data } = await ctx.supabase.storage.from("branding").createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    };
    const [logo, signature, payment_qr] = await Promise.all([sign(b.logo_path), sign(b.signature_path), sign(b.payment_qr_path)]);
    content = <ProfileForm business={b} images={{ logo, signature, payment_qr }} />;
  } else if (tab === "preferences") {
    content = <PreferencesForm business={b} />;
  } else if (tab === "numbering") {
    const period = b.reset_yearly ? financialYear(todayIST()) : "all";
    const { data } = await ctx.supabase.from("number_sequences").select("doc_type, next_value").eq("period", period);
    const next = Object.fromEntries((data ?? []).map((r) => [r.doc_type, r.next_value]));
    content = <NumberingForm business={b} next={next} />;
  } else if (tab === "templates") {
    content = <TemplatesForm business={b} />;
  } else if (tab === "email") {
    content = (
      <div className="space-y-4 text-sm text-slate-600">
        <p>
          Emails are sent from your Google account by a small Google Apps Script, with the PDF attached. The same script saves PDFs into a{" "}
          <b>SmartBill</b> folder in your Google Drive (by financial year, type and month).
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open <a href="https://script.google.com" target="_blank" rel="noopener" className="text-brand-700 underline">script.google.com</a> → New project, and
            paste the code from <code className="font-mono">gas/Code.gs</code> in this project.
          </li>
          <li>Project Settings → Script properties → add <code className="font-mono">SHARED_SECRET</code> with a long random value.</li>
          <li>Run the <code className="font-mono">authorize</code> function once and allow Gmail and Drive access.</li>
          <li>Deploy → New deployment → Web app → Execute as <b>Me</b>, access <b>Anyone</b>. Copy the URL.</li>
          <li>
            Set <code className="font-mono">GAS_WEBAPP_URL</code> and <code className="font-mono">GAS_SHARED_SECRET</code> in your hosting environment and redeploy.
          </li>
        </ol>
        <p className="text-xs">Limits: 100 emails/day on a free Gmail account, 1,500/day on Google Workspace.</p>
        <GasTest configured={gasConfigured()} />
      </div>
    );
  } else {
    content = (
      <div className="max-w-sm space-y-3">
        <p className="text-sm text-slate-600">
          Signed in as <b>{ctx.email}</b>
        </p>
        <PasswordForm from="settings" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-5 md:flex-row">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:w-48 md:flex-col">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/settings?tab=${key}`}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                tab === key ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="card card-pad min-w-0 flex-1">{content}</div>
      </div>
    </>
  );
}
