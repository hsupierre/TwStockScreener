"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatNumber, formatPercent } from "@/lib/format";
import type { QuarterSummary, RevenuePoint } from "@/lib/stock/compute";

const revenueConfig = {
  revenue: { label: "月營收（億元）", color: "var(--chart-2)" },
  yoy: { label: "年增率（%）", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RevenueChart({ data }: { data: readonly RevenuePoint[] }) {
  return (
    <ChartContainer
      config={revenueConfig}
      className="aspect-auto h-72 w-full"
      role="img"
      aria-label="近 24 個月營收與年增率"
    >
      <ComposedChart data={[...data]} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis
          yAxisId="revenue"
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatNumber(v, 0)}
        />
        <YAxis
          yAxisId="yoy"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => `${v}%`}
        />
        <ReferenceLine yAxisId="yoy" y={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="tabular">
                  {revenueConfig[name as keyof typeof revenueConfig]?.label}：
                  {name === "yoy"
                    ? formatPercent(Number(value), 1, { signed: true })
                    : `${formatNumber(Number(value), 2)} 億`}
                </span>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="revenue" dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="yoy"
          dataKey="yoy"
          stroke="var(--color-yoy)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  );
}

const epsConfig = { eps: { label: "單季 EPS（元）", color: "var(--chart-3)" } } satisfies ChartConfig;

export function EpsChart({ data }: { data: readonly QuarterSummary[] }) {
  return (
    <ChartContainer
      config={epsConfig}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="近 12 季 EPS"
    >
      <BarChart data={[...data]} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatNumber(v, 0)} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => <span className="tabular">EPS：{formatNumber(Number(value), 2)} 元</span>}
            />
          }
        />
        <Bar dataKey="eps" radius={[3, 3, 0, 0]}>
          {data.map((q) => (
            <Cell key={q.label} fill={q.eps !== null && q.eps < 0 ? "var(--down)" : "var(--color-eps)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
