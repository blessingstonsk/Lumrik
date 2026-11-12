"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Datum {
  label: string;
  value: number;
  sub?: string; // tooltip detail (e.g. full date)
  highlight?: boolean;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Datum }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-muted">{d.sub ?? d.label}</p>
      <p className="mt-0.5 text-sm font-bold text-fg">
        {d.value} {unit}
      </p>
    </div>
  );
}

/**
 * Single-series bar chart (one hue, so no legend – the card title names the series).
 * Thin bars with rounded data-ends, recessive grid, hover tooltip, and a screen-reader table.
 */
export function SimpleBarChart({ data, unit, height = 200, title }: { data: Datum[]; unit: string; height?: number; title: string }) {
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={44} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip unit={unit} />} />
            <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.sub ?? d.label}>
              <td>{d.sub ?? d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal labelled meter list – used for accuracy by exercise type. Values are printed, so color is never the only cue. */
export function MeterList({ items }: { items: { label: string; value: number; detail?: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold">{it.label}</span>
            <span className="text-muted">
              <span className="font-bold text-fg">{it.value}%</span>
              {it.detail && ` · ${it.detail}`}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-2" role="progressbar" aria-valuenow={it.value} aria-valuemin={0} aria-valuemax={100} aria-label={`${it.label} accuracy`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, it.value)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
