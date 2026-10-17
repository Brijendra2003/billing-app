"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel } from "@/lib/format";

// Validated categorical slots (light surface): 1 = blue, 2 = orange.
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${n}`;
};

function TooltipBox({ active, payload, label, title }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number; title: (l: string | number) => string }) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{title(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <b className="tabular-nums text-slate-900">{inr.format(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

export function DailySalesChart({ data, month }: { data: { day: number; sales: number }[]; month: string }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Daily sales for the month">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={52} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.15)" }}
            content={<TooltipBox title={(d) => `${d} ${monthLabel(month)}`} />}
          />
          <Bar dataKey="sales" name="Net sales" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data }: { data: { month: string; sales: number; collected: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Sales and collections over six months">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m).slice(0, 3)} tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={52} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.15)" }} content={<TooltipBox title={(m) => monthLabel(String(m))} />} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: AXIS }} />
          <Bar dataKey="sales" name="Net sales" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="collected" name="Collected" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
