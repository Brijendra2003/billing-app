"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button className="btn-secondary btn-sm no-print" onClick={() => window.print()}>
      <Printer className="size-4" /> {label}
    </button>
  );
}
