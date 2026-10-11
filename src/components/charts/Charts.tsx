import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table2, ChartColumn } from 'lucide-react';
import { CHART_INK, ChartTable, Legend, TooltipRow, TooltipShell } from './ChartKit';
import { Button } from '@/components/ui/Button';
import { compact, num } from '@/lib/utils';

/* ── shared axis config ────────────────────────────────────────────────── */

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART_INK.muted, fontSize: 11 },
} as const;

/** Chart ⇄ table toggle. The table view is the relief every chart must carry. */
function ViewToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="text-ink-3"
      icon={table ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
    >
      {table ? 'Chart' : 'Table'}
    </Button>
  );
}

export function useChartView() {
  const [table, setTable] = useState(false);
  return { table, toggle: () => setTable((t) => !t), ViewToggle };
}

/* ── Column chart ──────────────────────────────────────────────────────── */

export interface ColumnDatum {
  name: string;
  value: number;
  /** Optional per-bar override — used for threshold/status coloring. */
  color?: string;
  meta?: string;
}

/**
 * Single-series column chart. One series means no legend box (the card title
 * names what is plotted); bars are capped at 24px with a 4px rounded cap.
 */
export function ColumnChart({
  data,
  height = 260,
  unit = '',
  color = 'var(--s1)',
  valueLabel = 'Value',
  maxValue,
  reference,
}: {
  data: ColumnDatum[];
  height?: number;
  unit?: string;
  color?: string;
  valueLabel?: string;
  maxValue?: number;
  /** A horizontal threshold line, e.g. the 75% attendance bar. */
  reference?: { value: number; label: string };
}) {
  const { table, toggle } = useChartView();

  if (table) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ViewToggle table onToggle={toggle} />
        </div>
        <ChartTable
          columns={['Category', valueLabel]}
          rows={data.map((d) => [d.meta ?? d.name, `${num(d.value)}${unit}`])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ViewToggle table={false} onToggle={toggle} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />
          <XAxis dataKey="name" {...axisProps} interval={0} />
          <YAxis
            {...axisProps}
            width={52}
            domain={[0, maxValue ?? 'auto']}
            // Abbreviated, because a rupee total runs to eight characters
            // ('4,59,750') and was being cut off by the axis. The tooltip and
            // the table view still carry the exact figure.
            tickFormatter={(v: number) => `${compact(v)}${unit}`}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)', radius: 6 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipShell title={payload[0]!.payload.meta ?? payload[0]!.payload.name}>
                  <TooltipRow
                    color={payload[0]!.payload.color ?? color}
                    label={valueLabel}
                    value={`${num(Number(payload[0]!.value))}${unit}`}
                  />
                </TooltipShell>
              ) : null
            }
          />
          {reference ? (
            <ReferenceLine
              y={reference.value}
              stroke={CHART_INK.axis}
              strokeDasharray="4 4"
              label={{
                value: reference.label,
                position: 'insideTopRight',
                fill: CHART_INK.muted,
                fontSize: 11,
              }}
            />
          ) : null}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Grouped column chart (≤3 series) ──────────────────────────────────── */

export function GroupedColumnChart({
  data,
  series,
  height = 280,
  unit = '',
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  unit?: string;
}) {
  const { table, toggle } = useChartView();

  if (table) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ViewToggle table onToggle={toggle} />
        </div>
        <ChartTable
          columns={['Category', ...series.map((s) => s.label)]}
          rows={data.map((d) => [
            String(d.name),
            ...series.map((s) => `${num(Number(d[s.key] ?? 0))}${unit}`),
          ])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Two or more series → the legend is always present. */}
        <Legend items={series.map((s) => ({ color: s.color, label: s.label }))} />
        <ViewToggle table={false} onToggle={toggle} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} barCategoryGap="26%" barGap={2}>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
          <XAxis dataKey="name" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={52} tickFormatter={(v: number) => `${compact(v)}${unit}`} />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)', radius: 6 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipShell title={label}>
                  {payload.map((p) => {
                    const s = series.find((x) => x.key === p.dataKey);
                    return (
                      <TooltipRow
                        key={String(p.dataKey)}
                        color={s?.color}
                        label={s?.label ?? String(p.dataKey)}
                        value={`${num(Number(p.value))}${unit}`}
                      />
                    );
                  })}
                </TooltipShell>
              ) : null
            }
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={20} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Horizontal bar chart ──────────────────────────────────────────────── */

export function BarList({
  data,
  unit = '',
  valueLabel = 'Value',
  height = 280,
  color = 'var(--s1)',
}: {
  data: ColumnDatum[];
  unit?: string;
  valueLabel?: string;
  height?: number;
  color?: string;
}) {
  const { table, toggle } = useChartView();

  if (table) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ViewToggle table onToggle={toggle} />
        </div>
        <ChartTable
          columns={['Category', valueLabel]}
          rows={data.map((d) => [d.meta ?? d.name, `${num(d.value)}${unit}`])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ViewToggle table={false} onToggle={toggle} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 0, left: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid horizontal={false} stroke={CHART_INK.grid} />
          <XAxis type="number" {...axisProps} tickFormatter={(v: number) => `${compact(v)}${unit}`} />
          <YAxis type="category" dataKey="name" {...axisProps} width={72} />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)', radius: 6 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipShell title={payload[0]!.payload.meta ?? payload[0]!.payload.name}>
                  <TooltipRow
                    color={payload[0]!.payload.color ?? color}
                    label={valueLabel}
                    value={`${num(Number(payload[0]!.value))}${unit}`}
                  />
                </TooltipShell>
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Trend area chart ──────────────────────────────────────────────────── */

export function TrendChart({
  data,
  dataKey = 'percent',
  xKey = 'month',
  unit = '%',
  label = 'Attendance',
  height = 220,
  color = 'var(--s1)',
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  xKey?: string;
  unit?: string;
  label?: string;
  height?: number;
  color?: string;
}) {
  const { table, toggle } = useChartView();

  if (table) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ViewToggle table onToggle={toggle} />
        </div>
        <ChartTable
          columns={['Period', label]}
          rows={data.map((d) => [String(d[xKey]), `${d[dataKey]}${unit}`])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ViewToggle table={false} onToggle={toggle} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis
            {...axisProps}
            width={48}
            // A percentage axis must not run past 100, which 'dataMax + 4' would do.
            domain={[(min: number) => Math.max(0, Math.floor(min - 6)), unit === '%' ? 100 : 'auto']}
            tickFormatter={(v: number) => `${Math.round(v)}${unit}`}
          />
          <Tooltip
            cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }}
            content={({ active, payload, label: l }) =>
              active && payload?.length ? (
                <TooltipShell title={l}>
                  <TooltipRow color={color} label={label} value={`${payload[0]!.value}${unit}`} />
                </TooltipShell>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill="url(#trendWash)"
            dot={{ r: 4, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */

export function Sparkline({
  data,
  color = 'var(--s1)',
  height = 34,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.1}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
