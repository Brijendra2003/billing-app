export interface LedgerEntry {
  date: string;
  kind: "opening" | "invoice" | "credit_note" | "payment";
  ref: string;
  docId: string | null;
  debit: number;
  credit: number;
  balance: number;
}

/** Builds a running-balance statement: invoices increase what the client owes; payments and credit notes reduce it. */
export function buildLedger(input: {
  openingBalance: number;
  documents: { id: string; doc_type: string; status: string; number: string | null; issue_date: string; grand_total: number }[];
  payments: { paid_on: string; amount: number; method: string; reference: string; document_id: string }[];
  docNumbers?: Map<string, string>;
}): LedgerEntry[] {
  const rows: Omit<LedgerEntry, "balance">[] = [];
  if (input.openingBalance) {
    rows.push({
      date: "",
      kind: "opening",
      ref: "Opening balance",
      docId: null,
      debit: Math.max(input.openingBalance, 0),
      credit: Math.max(-input.openingBalance, 0),
    });
  }
  for (const d of input.documents) {
    if (d.status === "draft" || d.status === "cancelled") continue;
    if (d.doc_type === "tax_invoice") {
      rows.push({ date: d.issue_date, kind: "invoice", ref: d.number ?? "", docId: d.id, debit: d.grand_total, credit: 0 });
    } else if (d.doc_type === "credit_note") {
      rows.push({ date: d.issue_date, kind: "credit_note", ref: d.number ?? "", docId: d.id, debit: 0, credit: d.grand_total });
    }
  }
  for (const p of input.payments) {
    const against = input.docNumbers?.get(p.document_id);
    rows.push({
      date: p.paid_on,
      kind: "payment",
      ref: `Payment (${p.method.replace("_", " ")})${p.reference ? ` ${p.reference}` : ""}${against ? ` — ${against}` : ""}`,
      docId: p.document_id,
      debit: 0,
      credit: p.amount,
    });
  }
  const order = { opening: 0, invoice: 1, credit_note: 2, payment: 3 };
  rows.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);

  let balance = 0;
  return rows.map((r) => {
    balance = Math.round((balance + r.debit - r.credit) * 100) / 100;
    return { ...r, balance };
  });
}
