"use client";

import dynamic from "next/dynamic";

/**
 * 圖表（Recharts 約 370 KB）延遲到瀏覽器端載入，不佔用首屏的下載與執行時間（TBT）。
 * 預留與圖表相同的高度，載入完成時版面不會跳動（CLS 0）。
 */
function ChartPlaceholder({ height }: { height: string }) {
  return <div className={`${height} w-full animate-pulse rounded-md bg-muted`} aria-hidden />;
}

export const RevenueChart = dynamic(() => import("./charts").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <ChartPlaceholder height="h-72" />,
});

export const EpsChart = dynamic(() => import("./charts").then((m) => m.EpsChart), {
  ssr: false,
  loading: () => <ChartPlaceholder height="h-64" />,
});
