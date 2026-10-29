'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const axis = { fontSize: 11, fill: 'var(--ink-3)' };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-2">
          <i className="block size-2 rounded-sm" style={{ background: p.color }} />
          {p.name} <b className="tnum ml-auto text-ink">{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: ReactNode; color: string; dim?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
      {items.map((i, k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <i className="block size-2 rounded-[2px]" style={{ background: i.color, opacity: i.dim ? 0.3 : 1 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Area for the first series, plain lines for the rest; optional dashed reference line. */
export function TrendChart({
  data,
  series,
  height = 200,
  reference,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  reference?: { key: string; name: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="1" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
        <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line-2)', strokeDasharray: '4 4' }} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            fill={i === 0 ? `url(#fill-${s.key})` : 'transparent'}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
            connectNulls
          />
        ))}
        {reference && <Line type="linear" dataKey={reference.key} name={reference.name} stroke="var(--ink-4)" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Grouped vertical bars. */
export function BarsChart({ data, bars, height = 180 }: { data: Record<string, string | number>[]; bars: { key: string; name: string; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barGap={4} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
        <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={0} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 1, 1]} maxBarSize={16} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut with a total in the middle. */
export function Donut({ parts, size = 128, center, sub }: { parts: { name: string; value: number; color: string }[]; size?: number; center: ReactNode; sub?: ReactNode }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={shown.length ? shown : [{ name: 'None', value: 1, color: 'var(--hover)' }]}
          dataKey="value"
          innerRadius={size / 2 - 15}
          outerRadius={size / 2 - 1}
          paddingAngle={shown.length > 1 ? 2 : 0}
          stroke="none"
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        >
          {(shown.length ? shown : [{ color: 'var(--hover)' }]).map((p, i) => (
            <Cell key={i} fill={p.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-semibold tracking-tight" style={{ fontSize: Math.round(size / 5) }}>
          {center}
        </span>
        {sub && <span className="text-[11.5px] text-ink-3">{sub}</span>}
      </div>
    </div>
  );
}

/** Horizontal bar list; a second value draws as a lighter tail (e.g. open + done). */
export function BarList({
  rows,
  max,
  labelWidth = 104,
  color = 'var(--accent)',
}: {
  rows: { label: ReactNode; value: number; extra?: number; color?: string; href?: string; icon?: ReactNode }[];
  max?: number;
  labelWidth?: number;
  color?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value + (r.extra ?? 0)));
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => {
        const body = (
          <>
            {r.icon}
            <span className="truncate text-[12.5px] text-ink-2" style={{ width: labelWidth }}>
              {r.label}
            </span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-hover">
              <i className="block rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: r.color ?? color }} />
              {r.extra !== undefined && <i className="block" style={{ width: `${(r.extra / top) * 100}%`, background: r.color ?? color, opacity: 0.28 }} />}
            </div>
            <span className="tnum w-7 text-right text-[12.5px] font-semibold">{r.value + (r.extra ?? 0)}</span>
          </>
        );
        return r.href ? (
          <Link key={i} href={r.href} className="-mx-1.5 flex h-6 items-center gap-2.5 rounded-md px-1.5 hover:bg-hover">
            {body}
          </Link>
        ) : (
          <div key={i} className="flex h-6 items-center gap-2.5">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** One stacked bar with a legend underneath. */
export function StackedBar({ parts, height = 10 }: { parts: { label: ReactNode; value: number; color: string; icon?: ReactNode }[]; height?: number }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1" style={{ height }} role="img" aria-label={parts.map((p) => `${p.value} ${p.label}`).join(', ')}>
        {total ? (
          parts.filter((p) => p.value).map((p, i) => <i key={i} className="block rounded-[3px]" style={{ flex: p.value, background: p.color }} />)
        ) : (
          <i className="block flex-1 rounded-[3px] bg-hover" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {p.icon ?? <i className="block size-2 rounded-[2px]" style={{ background: p.color }} />}
            {p.label} <b className="tnum text-ink">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
