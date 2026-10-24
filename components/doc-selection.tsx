"use client";

import { createContext, useContext, useState } from "react";
import { MessageCircle } from "lucide-react";

/** A selectable document plus the line it contributes to the WhatsApp message. */
export interface SelectableDoc {
  id: string;
  line: string;
}

interface Selection {
  selected: Map<string, string>;
  toggle: (docs: SelectableDoc[], on: boolean) => void;
  clear: () => void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("Selection components must be inside <SelectionProvider>");
  return ctx;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState(() => new Map<string, string>());
  const toggle = (docs: SelectableDoc[], on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const d of docs) {
        if (on) next.set(d.id, d.line);
        else next.delete(d.id);
      }
      return next;
    });
  return <SelectionContext value={{ selected, toggle, clear: () => setSelected(new Map()) }}>{children}</SelectionContext>;
}

/** Checkbox for one row, or for a whole month when given several docs. */
export function SelectBox({ docs, label }: { docs: SelectableDoc[]; label: string }) {
  const { selected, toggle } = useSelection();
  const count = docs.filter((d) => selected.has(d.id)).length;
  const all = docs.length > 0 && count === docs.length;
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      aria-label={label}
      disabled={docs.length === 0}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = count > 0 && !all;
      }}
      onChange={(e) => toggle(docs, e.target.checked)}
    />
  );
}

/** Opens WhatsApp with the selected documents' details and PDF links, addressed to the business's CA. */
export function ShareToCaButton({ caName, caPhone, businessName }: { caName: string; caPhone: string; businessName: string }) {
  const { selected, clear } = useSelection();
  const n = selected.size;
  const share = () => {
    const greeting = caName ? `Hello ${caName},` : "Hello,";
    const lines = [...selected.values()].map((l, i) => `${i + 1}. ${l}`);
    const text = `${greeting}\n\nSharing ${n} document${n === 1 ? "" : "s"} from ${businessName}:\n\n${lines.join("\n\n")}\n\nThank you.`;
    // Without a saved number WhatsApp asks which chat to send it to.
    const digits = caPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    clear();
  };
  return (
    <button
      type="button"
      className="btn-whatsapp"
      disabled={n === 0}
      onClick={share}
      title={n === 0 ? "Tick invoices in the list to share them" : caPhone ? undefined : "Add your CA's WhatsApp number in Settings to skip choosing a chat"}
    >
      <MessageCircle className="size-4" /> Share to CA{n > 0 ? ` (${n})` : ""}
    </button>
  );
}
