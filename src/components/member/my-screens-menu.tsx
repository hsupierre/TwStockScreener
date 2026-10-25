"use client";

import { Bookmark, Check, ListChecks, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loginHref } from "@/lib/auth/redirect";
import { useAuth } from "@/lib/auth/session";
import { createScreen, SCREENS_LIMIT, useSavedScreens } from "@/lib/member/screens";
import { sameScreenQuery, screenQuery, screenQueryHref } from "@/lib/screener/search-params";

import { ScreenNameDialog } from "./screen-name-dialog";

/** 選股器工具列：儲存目前條件、套用已儲存的策略。 */
export function MyScreensMenu() {
  const auth = useAuth();
  const screens = useSavedScreens();
  const router = useRouter();
  const params = useSearchParams();
  const [saving, setSaving] = useState(false);
  const current = params.toString();

  const currentHref = () => window.location.pathname + window.location.search;
  const full = screens.data.length >= SCREENS_LIMIT;

  function startSave() {
    if (auth.status !== "signedIn") {
      router.push(loginHref(currentHref()) as Route);
      return;
    }
    if (full) {
      toast.error(`我的策略最多 ${SCREENS_LIMIT} 個，請先刪除不需要的`);
      return;
    }
    setSaving(true);
  }

  async function save(name: string) {
    // 用瀏覽器上的原始網址（nuqs 寫入的格式），不用 URLSearchParams 重新編碼
    const result = await createScreen(name, screenQuery(window.location.search));
    if (!result.ok) return result.message;
    toast.success(`已儲存「${result.value.name}」`);
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark aria-hidden />
            我的策略
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
          <DropdownMenuItem onSelect={startSave} disabled={auth.status === "loading"}>
            <Plus aria-hidden />
            儲存目前的條件…
          </DropdownMenuItem>
          {auth.status === "signedIn" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {screens.status === "ready"
                  ? `已儲存 ${screens.data.length}／${SCREENS_LIMIT}`
                  : screens.status === "error"
                    ? "讀取失敗"
                    : "讀取中…"}
              </DropdownMenuLabel>
              {screens.data.map((s) => {
                const active = sameScreenQuery(s.query, current);
                return (
                  <DropdownMenuItem key={s.id} asChild>
                    <Link href={screenQueryHref(s.query) as Route} aria-current={active ? "true" : undefined}>
                      <Check className={active ? "opacity-100" : "opacity-0"} aria-hidden />
                      <span className="truncate">{s.name}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/strategies">
                  <ListChecks aria-hidden />
                  管理我的策略
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ScreenNameDialog
        open={saving}
        onOpenChange={setSaving}
        title="儲存目前的條件"
        description="篩選條件、排序與顯示欄位都會一起儲存。"
        submitLabel="儲存"
        onSubmit={save}
      />
    </>
  );
}
