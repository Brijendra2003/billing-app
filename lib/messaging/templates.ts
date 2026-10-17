import { money, date } from "@/lib/format";
import { DOC_LABEL, type DocType } from "@/lib/types";

export interface TemplateVars {
  client_name: string;
  doc_label: string;
  number: string;
  date: string;
  amount: string;
  balance: string;
  due_date: string;
  link: string;
  business_name: string;
}

export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : m,
  );
}

export function documentVars(
  doc: {
    doc_type: DocType;
    number: string | null;
    issue_date: string;
    due_date: string | null;
    grand_total: number;
    balance_due: number;
    bill_to: { name: string };
  },
  businessName: string,
  link: string,
): TemplateVars {
  return {
    client_name: doc.bill_to.name,
    doc_label: DOC_LABEL[doc.doc_type],
    number: doc.number ?? "(draft)",
    date: date(doc.issue_date),
    amount: money(doc.grand_total),
    balance: money(doc.balance_due),
    due_date: doc.due_date ? date(doc.due_date) : date(doc.issue_date),
    link,
    business_name: businessName,
  };
}

/** Click-to-chat link that opens the client's WhatsApp chat with a pre-filled message. */
export function whatsappUrl(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** UPI deep link; amount is optional. */
export function upiUrl(upiId: string, payeeName: string, amount?: number, note?: string): string {
  const p = new URLSearchParams({ pa: upiId, pn: payeeName, cu: "INR" });
  if (amount && amount > 0) p.set("am", amount.toFixed(2));
  if (note) p.set("tn", note);
  return `upi://pay?${p.toString()}`;
}
