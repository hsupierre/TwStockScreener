import { EMPTY, formatNumber, formatPercent, formatYi } from "@/lib/format";
import type { DividendYear, QuarterSummary } from "@/lib/stock/compute";
import { cn } from "@/lib/utils";

const th = "border-b px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground";
const td = "border-b px-3 py-2 text-right whitespace-nowrap";

/** 虧損或現金流出標成綠色（台股慣例：綠代表負） */
function signedClass(v: number | null) {
  return v !== null && v < 0 ? "text-down" : "";
}

/** 近 12 季財報（新的在左），橫向捲動；金額固定以億元顯示，方便同列比較。 */
export function QuarterlyTable({ quarters }: { quarters: readonly QuarterSummary[] }) {
  if (quarters.length === 0) return <p className="text-sm text-muted-foreground">尚無季報資料。</p>;
  const cols = [...quarters].reverse();
  const rows: {
    label: string;
    render: (q: QuarterSummary) => string;
    cls?: (q: QuarterSummary) => string;
  }[] = [
    { label: "營業收入（億）", render: (q) => formatYi(q.revenue) },
    { label: "毛利率", render: (q) => formatPercent(q.grossMargin, 1) },
    { label: "營益率", render: (q) => formatPercent(q.operatingMargin, 1) },
    { label: "淨利率", render: (q) => formatPercent(q.netMargin, 1) },
    { label: "稅後淨利（億）", render: (q) => formatYi(q.netIncome), cls: (q) => signedClass(q.netIncome) },
    { label: "EPS（元）", render: (q) => formatNumber(q.eps, 2), cls: (q) => signedClass(q.eps) },
    {
      label: "營業現金流（億）",
      render: (q) => formatYi(q.operatingCashFlow),
      cls: (q) => signedClass(q.operatingCashFlow),
    },
    { label: "負債比", render: (q) => formatPercent(q.debtRatio, 1) },
  ];
  return (
    <div className="overflow-x-auto rounded-md border" tabIndex={0} aria-label="季報（可橫向捲動）">
      <table className="tabular w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th scope="col" className={cn(th, "sticky left-0 z-10 bg-muted text-left")}>
              單季
            </th>
            {cols.map((q) => (
              <th key={q.label} scope="col" className={th}>
                {q.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={cn(td, "sticky left-0 bg-background text-left font-normal")}>
                {r.label}
              </th>
              {cols.map((q) => (
                <td key={q.label} className={cn(td, r.cls?.(q))}>
                  {r.render(q)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DividendTable({ years }: { years: readonly DividendYear[] }) {
  if (years.length === 0) return <p className="text-sm text-muted-foreground">近 10 年沒有股利分派紀錄。</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="tabular w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th scope="col" className={cn(th, "text-left")}>
              所屬年度
            </th>
            <th scope="col" className={th}>
              現金股利（元）
            </th>
            <th scope="col" className={th}>
              股票股利（元）
            </th>
            <th scope="col" className={th}>
              發放次數
            </th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year}>
              <th scope="row" className={cn(td, "text-left font-normal")}>
                {y.year}
              </th>
              <td className={td}>{y.cash ? formatNumber(y.cash, 2) : EMPTY}</td>
              <td className={td}>{y.stock ? formatNumber(y.stock, 2) : EMPTY}</td>
              <td className={cn(td, "text-muted-foreground")}>{y.payments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
