"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">發生錯誤</h1>
      <p className="text-muted-foreground">頁面暫時無法顯示，請稍後再試。</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">錯誤代碼：{error.digest}</p>}
      <Button onClick={reset}>重新載入</Button>
    </div>
  );
}
