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
import { type Candle, MA_PERIODS } from "@/lib/stock/candles";
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

const TREND_COLOR = { up: "var(--up)", down: "var(--down)", flat: "var(--muted-foreground)" } as const;

const candleConfig = {
  ma5: { label: "5 日均線", color: "var(--chart-1)" },
  ma20: { label: "20 日均線", color: "var(--chart-3)" },
  ma60: { label: "60 日均線", color: "var(--chart-4)" },
} satisfies ChartConfig;

const volumeConfig = {
  lots: { label: "成交量（張）", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/** 價格的小數位數：高價股不顯示小數，避免座標軸太擠。 */
const priceDigits = (v: number) => (v >= 1000 ? 0 : v >= 100 ? 1 : 2);

interface CandleShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: Candle;
}

/**
 * 自訂的 K 棒：Bar 的資料是 [最低, 最高]，Recharts 給的 y／height 對應最高到最低的像素範圍，
 * 再依比例算出開盤、收盤的位置畫實體。
 */
function CandleShape({ x, y, width, height, payload: c }: CandleShapeProps) {
  const color = TREND_COLOR[c.trend];
  const span = c.high - c.low;
  const toY = (price: number) => (span === 0 ? y + height / 2 : y + ((c.high - price) / span) * height);
  const top = toY(Math.max(c.open, c.close));
  const bottom = toY(Math.min(c.open, c.close));
  const bodyWidth = Math.max(Math.min(width * 0.7, 12), 1);
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + Math.max(height, 1)} stroke={color} strokeWidth={1} />
      <rect
        x={cx - bodyWidth / 2}
        y={top}
        width={bodyWidth}
        height={Math.max(bottom - top, 1)}
        fill={color}
        stroke={color}
      />
    </g>
  );
}

function CandleTooltip({ active, payload }: { active?: boolean; payload?: { payload: Candle }[] }) {
  const c = payload?.[0]?.payload;
  if (!active || !c) return null;
  const d = priceDigits(c.close);
  const rows: [string, string][] = [
    ["開盤", formatNumber(c.open, d)],
    ["最高", formatNumber(c.high, d)],
    ["最低", formatNumber(c.low, d)],
    ["收盤", formatNumber(c.close, d)],
    ["漲跌", c.change === null ? "—" : `${c.change > 0 ? "+" : ""}${formatNumber(c.change, d)}`],
    ["成交量", c.lots === null ? "—" : `${formatNumber(c.lots, 0)} 張`],
  ];
  return (
    <div className="tabular grid min-w-36 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{c.date}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd
              className="text-right"
              style={k === "收盤" || k === "漲跌" ? { color: TREND_COLOR[c.trend] } : undefined}
            >
              {v}
            </dd>
          </div>
        ))}
        {MA_PERIODS.map((n) => {
          const v = c[`ma${n}`];
          return v === null ? null : (
            <div key={n} className="contents">
              <dt style={{ color: candleConfig[`ma${n}`].color }}>{n} 日均線</dt>
              <dd className="text-right">{formatNumber(v, d)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/**
 * 均線圖例（固定 5／20／60 的順序）。Recharts 內建圖例的順序不固定，也會把 K 棒列進去；
 * 資料還不夠畫出一段線時（例如剛開始累積的 60 日均線）加註說明。
 */
function MaLegend({ candles }: { candles: readonly Candle[] }) {
  return (
    <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {MA_PERIODS.map((n) => {
        const points = candles.filter((c) => c[`ma${n}`] !== null).length;
        return (
          <li key={n} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded"
              style={{ background: candleConfig[`ma${n}`].color }}
              aria-hidden
            />
            {n} 日均線{points < 2 && "（資料累積中）"}
          </li>
        );
      })}
    </ul>
  );
}

/** 日 K 線（紅漲綠跌）＋5／20／60 日均線，下方是成交量；兩張圖以 syncId 連動提示框。 */
export function CandleChart({ data }: { data: readonly Candle[] }) {
  const candles = [...data];
  return (
    <div
      className="flex flex-col gap-1"
      role="img"
      aria-label={`近 ${candles.length} 個交易日的日 K 線與成交量`}
    >
      <MaLegend candles={candles} />
      <ChartContainer config={candleConfig} className="aspect-auto h-72 w-full">
        <ComposedChart data={candles} syncId="daily" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatNumber(v, priceDigits(v))}
          />
          <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<CandleTooltip />} />
          <Bar
            dataKey="range"
            isAnimationActive={false}
            shape={(props: unknown) => <CandleShape {...(props as CandleShapeProps)} />}
          />
          {MA_PERIODS.map((n) => (
            <Line
              key={n}
              dataKey={`ma${n}`}
              stroke={`var(--color-ma${n})`}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ChartContainer>
      <ChartContainer config={volumeConfig} className="aspect-auto h-24 w-full">
        <BarChart data={candles} syncId="daily" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickCount={3}
            tickFormatter={(v: number) =>
              v >= 10_000 ? `${formatNumber(v / 10_000, 0)}萬` : formatNumber(v, 0)
            }
          />
          <ChartTooltip cursor={{ fill: "var(--muted)" }} content={() => null} />
          <Bar dataKey="lots" isAnimationActive={false}>
            {candles.map((c) => (
              <Cell key={c.date} fill={TREND_COLOR[c.trend]} fillOpacity={0.6} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
