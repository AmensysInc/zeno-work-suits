import type { ReactNode } from 'react';
import { Card, Empty } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

/** Validated categorical slots (blue, orange) and a one-hue ordinal ramp. */
export const series = ['#2a78d6', '#eb6834'] as const;
export const ramp = ['#86b6ef', '#5598e7', '#256abf', '#0d366b'] as const;
const ink = { muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' };
const tick = { fill: ink.muted, fontSize: 11 };

export interface Datum {
  name: string;
  [key: string]: string | number;
}
export interface Series {
  key: string;
  name: string;
  color: string;
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((p) => (
        <div key={String(p.dataKey)}>
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  empty,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  empty?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`card chart-card ${className}`}
      title={
        <div className="chart-title">
          <span>{title}</span>
          {subtitle && <small>{subtitle}</small>}
        </div>
      }
    >
      {empty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data yet" />
      ) : (
        children
      )}
    </Card>
  );
}

/** Lines over time; one y-axis, a legend for two or more series. */
export function TrendChart({
  data,
  lines,
  height = 260,
}: {
  data: Datum[];
  lines: Series[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke={ink.grid} />
        <XAxis
          dataKey="name"
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: ink.axis }}
        />
        <YAxis
          allowDecimals={false}
          tick={tick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={ChartTooltip}
          cursor={{ stroke: ink.axis, strokeDasharray: '4 4' }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          height={28}
          itemSorter={null}
          wrapperStyle={{ fontSize: 12 }}
        />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="linear"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Bars by category. `bars` stack when there is more than one; `colors`
 * paints a single series per category (an ordinal ramp).
 */
export function BarsChart({
  data,
  bars,
  colors,
  horizontal = false,
  height = 240,
  onSelect,
}: {
  data: Datum[];
  bars: Series[];
  colors?: readonly string[];
  horizontal?: boolean;
  height?: number;
  onSelect?: (d: Datum) => void;
}) {
  const stacked = bars.length > 1;
  const category = (
    <>
      {horizontal ? (
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: ink.axis }}
        />
      ) : (
        <XAxis
          dataKey="name"
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: ink.axis }}
          interval={0}
        />
      )}
      {horizontal ? (
        <XAxis
          type="number"
          allowDecimals={false}
          tick={tick}
          tickLine={false}
          axisLine={false}
        />
      ) : (
        <YAxis
          allowDecimals={false}
          tick={tick}
          tickLine={false}
          axisLine={false}
        />
      )}
    </>
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 12, left: horizontal ? 0 : -16, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid
          horizontal={!horizontal}
          vertical={horizontal}
          stroke={ink.grid}
        />
        {category}
        <Tooltip
          content={ChartTooltip}
          cursor={{ fill: 'rgba(79,110,247,0.06)' }}
        />
        {stacked && (
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            height={28}
            itemSorter={null}
            wrapperStyle={{ fontSize: 12 }}
          />
        )}
        {bars.map((b, i) => {
          const last = i === bars.length - 1;
          return (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name}
              stackId={stacked ? 'stack' : undefined}
              fill={b.color}
              maxBarSize={horizontal ? 18 : 36}
              radius={
                last ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined
              }
              stroke="#fff"
              strokeWidth={stacked ? 1 : 0}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={
                onSelect ? (d) => onSelect(d.payload as Datum) : undefined
              }
              shape={
                colors
                  ? (props: { index?: number; fill?: string }) => (
                      <RampBar {...props} fill={colors[props.index ?? 0]} />
                    )
                  : undefined
              }
            >
              {!stacked && (
                <LabelList
                  dataKey={b.key}
                  position={horizontal ? 'right' : 'top'}
                  fill="#52514e"
                  fontSize={11}
                />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A rounded bar in its own ramp color. */
function RampBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const r = Math.min(4, width / 2, Math.abs(height));
  return (
    <path
      fill={fill}
      d={`M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`}
    />
  );
}
