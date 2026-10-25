import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server"; // 不帶 "use client" 的入口，伺服器（首頁連結）與瀏覽器共用

import type { Range, Ranges, ScreenerFilters, Sort, SortKey } from "./filters";
import { DEFAULT_COLUMNS, METRIC_BY_KEY, METRIC_BY_PARAM, METRICS, type MetricKey } from "./metrics";
import type { Preset } from "./presets";
import { MARKETS } from "./types";

/**
 * 網址格式（全部選填）：
 *   /screener?dy=4~&pe=~15&roe=8~20&m=twse&ind=半導體業,光電業&q=台積&s=dy.desc&cols=price,pe,dy
 * 範圍用「最小~最大」，任一邊可省略；`~` 在網址中不需要編碼。
 */

const NUM = /^-?\d+(\.\d+)?$/;

function parseBound(value: string): number | null | undefined {
  if (value === "") return null;
  return NUM.test(value) ? Number(value) : undefined;
}

export const parseAsRange = createParser<Range>({
  parse(value) {
    const parts = value.split("~");
    if (parts.length !== 2) return null;
    const min = parseBound(parts[0]!);
    const max = parseBound(parts[1]!);
    if (min === undefined || max === undefined || (min === null && max === null)) return null;
    if (min !== null && max !== null && min > max) return { min: max, max: min };
    return { min, max };
  },
  serialize: (r) => `${r.min ?? ""}~${r.max ?? ""}`,
  eq: (a, b) => a.min === b.min && a.max === b.max,
});

const SORT_KEYS = ["code", ...METRICS.map((m) => m.param)] as const;

export const DEFAULT_SORT: Sort = { key: "market_cap", desc: true };

export const parseAsSort = createParser<Sort>({
  parse(value) {
    const [param, dir] = value.split(".");
    if (!param || !(SORT_KEYS as readonly string[]).includes(param) || (dir !== "asc" && dir !== "desc")) {
      return null;
    }
    const key: SortKey = param === "code" ? "code" : METRIC_BY_PARAM[param]!.key;
    return { key, desc: dir === "desc" };
  },
  serialize: (s) => `${s.key === "code" ? "code" : METRIC_BY_KEY[s.key].param}.${s.desc ? "desc" : "asc"}`,
  eq: (a, b) => a.key === b.key && a.desc === b.desc,
});

const COLUMN_PARAMS = METRICS.map((m) => m.param);
export const DEFAULT_COLUMN_PARAMS = DEFAULT_COLUMNS.map((k) => METRIC_BY_KEY[k].param);

/** 固定欄位：搜尋、市場、產業、排序、顯示欄位。 */
export const baseParsers = {
  q: parseAsString.withDefault(""),
  m: parseAsArrayOf(parseAsStringLiteral(MARKETS)).withDefault([]),
  ind: parseAsArrayOf(parseAsString).withDefault([]),
  s: parseAsSort.withDefault(DEFAULT_SORT),
  cols: parseAsArrayOf(parseAsStringLiteral(COLUMN_PARAMS)).withDefault(DEFAULT_COLUMN_PARAMS),
};

/** 每個指標一個範圍參數（參數名稱見 METRICS[].param）。 */
export const rangeParsers: Record<string, typeof parseAsRange> = Object.fromEntries(
  METRICS.map((m) => [m.param, parseAsRange]),
);

export type BaseState = inferParserType<typeof baseParsers>;
/** 要寫入網址的固定欄位；null 代表移除該參數（回到預設值）。 */
export type BaseUpdate = { [K in keyof BaseState]?: BaseState[K] | null };
/** 指標參數 → 範圍；null 代表移除該條件。 */
export type RangeState = Record<string, Range | null>;

const serializeBase = createSerializer(baseParsers);
const serializeRanges = createSerializer(rangeParsers);

export function stateToFilters(base: BaseState, ranges: RangeState): ScreenerFilters {
  const out: Ranges = {};
  for (const m of METRICS) {
    const r = ranges[m.param];
    if (r) out[m.key] = r;
  }
  return { q: base.q, markets: base.m, industries: base.ind, ranges: out };
}

/** 轉成「每個指標參數都有值」的物件；沒有的設為 null，套用時會清掉網址上舊的條件。 */
export function rangesToState(ranges: Ranges): RangeState {
  return Object.fromEntries(METRICS.map((m) => [m.param, ranges[m.key] ?? null]));
}

export function stateToColumns(cols: readonly string[]): MetricKey[] {
  return cols.flatMap((p) => (METRIC_BY_PARAM[p] ? [METRIC_BY_PARAM[p].key] : []));
}

export function columnsToState(columns: readonly MetricKey[]): string[] {
  return columns.map((k) => METRIC_BY_KEY[k].param);
}

export function presetToState(preset: Preset): { base: BaseUpdate; ranges: RangeState } {
  return {
    base: { s: preset.sort, cols: columnsToState(preset.columns) },
    ranges: rangesToState(preset.ranges),
  };
}

export function screenerHref(base: BaseUpdate = {}, ranges: RangeState = {}): string {
  return serializeRanges(serializeBase("/screener", base), ranges);
}

export function presetHref(preset: Preset): string {
  const { base, ranges } = presetToState(preset);
  return screenerHref(base, ranges);
}

const KNOWN_PARAMS = new Set([...Object.keys(baseParsers), ...Object.keys(rangeParsers)]);

/**
 * 「我的策略」要儲存的查詢字串：只保留選股器認得的參數，維持原本的寫法（不重新編碼）。
 * 例如 "?dy=4~&utm_source=x&roe=8~" → "dy=4~&roe=8~"。
 */
export function screenQuery(search: string): string {
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => {
      const key = pair.split("=")[0];
      if (!key || !pair.includes("=")) return false;
      try {
        return KNOWN_PARAMS.has(decodeURIComponent(key));
      } catch {
        return false;
      }
    })
    .join("&");
}

/** 兩個查詢字串的條件是否相同（忽略參數順序與編碼差異，例如 "~" 與 "%7E"）。 */
export function sameScreenQuery(a: string, b: string): boolean {
  const canon = (q: string) =>
    [...new URLSearchParams(screenQuery(q)).entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
  return canon(a) === canon(b);
}

export function screenQueryHref(query: string): string {
  return query ? `/screener?${query}` : "/screener";
}

const MARKET_NAMES: Record<string, string> = { twse: "上市", tpex: "上櫃" };

function formatRange(r: Range, unit: string): string {
  if (r.min !== null && r.max !== null) return `${r.min}～${r.max}${unit}`;
  return r.min !== null ? `≥ ${r.min}${unit}` : `≤ ${r.max}${unit}`;
}

/** 把儲存的條件轉成條列文字（策略清單上的摘要），例如 ["殖利率 ≥ 4%", "上市"]。 */
export function describeScreenQuery(query: string): string[] {
  const params = new URLSearchParams(query);
  const out: string[] = [];
  const q = baseParsers.q.parse(params.get("q") ?? "");
  if (q) out.push(`搜尋「${q}」`);
  const markets = baseParsers.m.parse(params.get("m") ?? "") ?? [];
  if (markets.length) out.push(markets.map((m) => MARKET_NAMES[m] ?? m).join("、"));
  const industries = baseParsers.ind.parse(params.get("ind") ?? "") ?? [];
  if (industries.length)
    out.push(industries.length <= 2 ? industries.join("、") : `${industries.length} 個產業`);
  for (const m of METRICS) {
    const raw = params.get(m.param);
    const r = raw ? parseAsRange.parse(raw) : null;
    if (r) out.push(`${m.label} ${formatRange(r, m.unit)}`);
  }
  return out;
}

/** 目前的篩選範圍是否剛好等於某個策略模板。 */
export function matchPreset(ranges: Ranges, presets: readonly Preset[]): Preset | undefined {
  const same = (a: Range | undefined, b: Range | undefined) => a?.min === b?.min && a?.max === b?.max;
  return presets.find((p) => METRICS.every((m) => same(ranges[m.key], p.ranges[m.key])));
}
