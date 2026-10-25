"use client";

import { LogIn } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/auth/redirect";
import { useAuth } from "@/lib/auth/session";
import type { ResourceStatus } from "@/lib/member/resource";

/**
 * 會員頁面共用：登入狀態讀取中顯示骨架、未登入顯示登入提示、讀取失敗顯示重試，
 * 都沒問題時才顯示內容。頁面本身維持靜態，這些判斷都在瀏覽器端進行。
 */
export function MemberGate({
  status,
  onRetry,
  what,
  children,
}: {
  /** 會員資料的讀取狀態 */
  status: ResourceStatus;
  onRetry: () => void;
  /** 例如「自選股」 */
  what: string;
  children: ReactNode;
}) {
  const auth = useAuth();
  const pathname = usePathname();

  if (auth.status === "signedOut") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-16 text-center">
        <p className="font-medium">登入後才能使用{what}</p>
        <p className="text-sm text-muted-foreground">使用 Google 帳號登入，免費、不需要另外註冊。</p>
        <Button asChild>
          <Link href={loginHref(pathname) as Route}>
            <LogIn aria-hidden />
            登入
          </Link>
        </Button>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-16 text-center" role="alert">
        <p className="font-medium">{what}讀取失敗</p>
        <Button variant="outline" onClick={onRetry}>
          重試
        </Button>
      </div>
    );
  }
  if (auth.status === "loading" || status !== "ready") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label={`${what}載入中`}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }
  return children;
}
