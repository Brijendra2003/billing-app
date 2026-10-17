"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, FileText, Receipt } from "lucide-react";
import { DIM_UNIT_LABEL, INCHES_PER } from "@/lib/tax/calculate";
import type { DimUnit } from "@/lib/types";

const UNITS = Object.keys(INCHES_PER) as DimUnit[];
const SQ_LABEL: Record<DimUnit, string> = { in: "Sq in", ft: "Sq ft", m: "Sq m", yd: "Sq yd (Gaj)", cm: "Sq cm", mm: "Sq mm" };
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: d }) : "0");

export function AreaCalculator() {
  const [unit, setUnit] = useState<DimUnit>("in");
  const [l, setL] = useState("");
  const [b, setB] = useState("");
  const [qty, setQty] = useState("1");
  const [rateUnit, setRateUnit] = useState<DimUnit>("ft");
  const [rate, setRate] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const L = Number(l) || 0;
  const B = Number(b) || 0;
  const Q = Number(qty) || 0;
  const sqIn = L * INCHES_PER[unit] * B * INCHES_PER[unit] * Q;
  const areaIn = (u: DimUnit) => sqIn / (INCHES_PER[u] * INCHES_PER[u]);
  const total = areaIn(rateUnit) * (Number(rate) || 0);
  const ratePerSqft = areaIn("ft") > 0 ? total / areaIn("ft") : 0;

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };
  // Invoice lines price by sq ft, so convert the rate.
  const areaParam = `${L},${B},${unit},${ratePerSqft.toFixed(2)},${Q || 1}`;
  const ready = L > 0 && B > 0;

  return (
    <div className="space-y-5">
      <div className="card card-pad grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 block sm:col-span-4">
          <span className="label">Size unit</span>
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as DimUnit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {DIM_UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Length</span>
          <input className="input text-lg" inputMode="decimal" value={l} onChange={(e) => setL(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Breadth</span>
          <input className="input text-lg" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Quantity</span>
          <input className="input text-lg" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Rate (₹) per</span>
          <div className="flex gap-1">
            <input className="input text-lg" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            <select className="input w-24 px-1" value={rateUnit} onChange={(e) => setRateUnit(e.target.value as DimUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {SQ_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="relative rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-6 text-center text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest opacity-80">Final amount</p>
        <p className="my-2 text-4xl font-black tabular-nums sm:text-5xl">₹ {fmt(total)}</p>
        <p className="text-sm font-semibold opacity-90">Rate / sq ft: ₹ {fmt(ratePerSqft)}</p>
        <button
          className="absolute right-3 top-3 rounded-lg p-2 opacity-70 hover:opacity-100"
          onClick={() => copy("total", `₹ ${total.toFixed(2)}`)}
          aria-label="Copy amount"
        >
          {copied === "total" ? <Check className="size-5" /> : <Copy className="size-5" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {UNITS.map((u) => {
          const a = areaIn(u);
          const perUnit = a > 0 ? total / a : 0;
          return (
            <button
              key={u}
              onClick={() => copy(u, a.toFixed(4))}
              className="card p-3 text-left transition hover:ring-2 hover:ring-brand-500/30"
              title="Copy area"
            >
              <p className="text-xs font-semibold uppercase text-slate-500">{SQ_LABEL[u]}</p>
              <p className="text-lg font-bold tabular-nums">{fmt(a, u === "mm" || u === "cm" ? 0 : 3)}</p>
              <p className="text-xs text-slate-500">₹ {fmt(perUnit, 4)} per {SQ_LABEL[u].toLowerCase()}</p>
              {copied === u && <p className="text-xs font-semibold text-emerald-600">Copied</p>}
            </button>
          );
        })}
      </div>

      <div className="card card-pad">
        <p className="mb-3 text-sm font-semibold text-slate-700">Size in every unit (one piece)</p>
        <div className="grid grid-cols-3 gap-y-1 text-sm">
          <span className="text-xs font-semibold text-slate-500">Unit</span>
          <span className="text-xs font-semibold text-slate-500">Length</span>
          <span className="text-xs font-semibold text-slate-500">Breadth</span>
          {UNITS.map((u) => (
            <span key={u} className="contents">
              <span className="font-medium text-brand-700">{DIM_UNIT_LABEL[u]}</span>
              <span className="tabular-nums">{fmt((L * INCHES_PER[unit]) / INCHES_PER[u], 3)}</span>
              <span className="tabular-nums">{fmt((B * INCHES_PER[unit]) / INCHES_PER[u], 3)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={ready ? `/invoices/new?area=${areaParam}` : "#"}
          aria-disabled={!ready}
          className={`btn-primary ${ready ? "" : "pointer-events-none opacity-50"}`}
        >
          <Receipt className="size-4" /> Use in invoice
        </Link>
        <Link
          href={ready ? `/quotations/new?area=${areaParam}` : "#"}
          aria-disabled={!ready}
          className={`btn-secondary ${ready ? "" : "pointer-events-none opacity-50"}`}
        >
          <FileText className="size-4" /> Use in quotation
        </Link>
      </div>
    </div>
  );
}
