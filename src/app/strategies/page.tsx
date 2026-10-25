import type { Metadata } from "next";

import { StrategiesView } from "@/components/member/strategies-view";

export const metadata: Metadata = {
  title: "我的策略",
  robots: { index: false },
};

export default function StrategiesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">我的策略</h1>
      <StrategiesView />
    </div>
  );
}
