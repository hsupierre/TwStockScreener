"use client";

import { Star } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/auth/redirect";
import { useAuth } from "@/lib/auth/session";
import { toggleWatch, useWatchlist } from "@/lib/member/watchlist";
import { cn } from "@/lib/utils";

/** 加入／移除自選股；未登入時導向登入頁（登入後回到目前頁面）。 */
function useWatchToggle(code: string, name: string) {
  const auth = useAuth();
  const watchlist = useWatchlist();
  const router = useRouter();
  const watched = watchlist.data.includes(code);
  // 登入狀態或清單還在讀取時先停用，避免誤判為「未加入」
  const pending = auth.status === "loading" || (auth.status === "signedIn" && watchlist.status !== "ready");

  async function toggle() {
    if (auth.status === "signedOut") {
      router.push(loginHref(window.location.pathname + window.location.search) as Route);
      return;
    }
    const result = await toggleWatch(code);
    if (!result.ok) toast.error(result.message);
    else toast.success(result.added ? `已將 ${name} 加入自選股` : `已將 ${name} 移出自選股`);
  }

  return { watched, pending, toggle };
}

/** 表格列用的星號（只有圖示）。 */
export function WatchStar({ code, name }: { code: string; name: string }) {
  const { watched, pending, toggle } = useWatchToggle(code, name);
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      aria-pressed={watched}
      aria-label={watched ? `將 ${name} 移出自選股` : `將 ${name} 加入自選股`}
      title={watched ? "移出自選股" : "加入自選股"}
      className="mr-1 -ml-1 inline-flex size-6 items-center justify-center rounded align-middle text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    >
      <Star className={cn("size-4", watched && "fill-amber-400 text-amber-500")} aria-hidden />
    </button>
  );
}

/** 個股頁用的按鈕（有文字）。 */
export function WatchButton({ code, name }: { code: string; name: string }) {
  const { watched, pending, toggle } = useWatchToggle(code, name);
  return (
    <Button
      variant={watched ? "secondary" : "outline"}
      size="sm"
      onClick={() => void toggle()}
      disabled={pending}
      aria-pressed={watched}
    >
      <Star className={cn(watched && "fill-amber-400 text-amber-500")} aria-hidden />
      {watched ? "已加入自選" : "加入自選"}
    </Button>
  );
}
