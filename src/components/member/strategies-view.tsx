"use client";

import { Bookmark, Pencil, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteScreen,
  reloadScreens,
  renameScreen,
  type SavedScreen,
  SCREENS_LIMIT,
  useSavedScreens,
} from "@/lib/member/screens";
import { describeScreenQuery, screenQueryHref } from "@/lib/screener/search-params";

import { MemberGate } from "./member-gate";
import { ScreenNameDialog } from "./screen-name-dialog";

const dateFormat = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" });

export function StrategiesView() {
  const screens = useSavedScreens();
  const [renaming, setRenaming] = useState<SavedScreen | null>(null);
  const [removing, setRemoving] = useState<SavedScreen | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!removing) return;
    setBusy(true);
    const result = await deleteScreen(removing.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`已刪除「${removing.name}」`);
    setRemoving(null);
  }

  return (
    <MemberGate status={screens.status} onRetry={reloadScreens} what="我的策略">
      {screens.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border px-4 py-16 text-center">
          <Bookmark className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">還沒有儲存的策略</p>
          <p className="text-sm text-muted-foreground">
            在選股器設定好條件後，按「我的策略」→「儲存目前的條件」。
          </p>
          <Button asChild>
            <Link href="/screener">開始選股</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            已儲存 {screens.data.length}／{SCREENS_LIMIT} 個
          </p>
          <ul className="flex flex-col divide-y rounded-md border">
            {screens.data.map((s) => {
              const conditions = describeScreenQuery(s.query);
              return (
                <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Link href={screenQueryHref(s.query) as Route} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.length === 0 ? (
                        <span className="text-sm text-muted-foreground">沒有篩選條件（全部股票）</span>
                      ) : (
                        conditions.map((c) => (
                          <Badge key={c} variant="secondary" className="font-normal">
                            {c}
                          </Badge>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      建立於 {dateFormat.format(new Date(s.created_at))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild size="sm">
                      <Link href={screenQueryHref(s.query) as Route}>套用</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`重新命名「${s.name}」`}
                      onClick={() => setRenaming(s)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`刪除「${s.name}」`}
                      onClick={() => setRemoving(s)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ScreenNameDialog
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="重新命名"
        initialName={renaming?.name ?? ""}
        submitLabel="儲存"
        onSubmit={async (name) => {
          if (!renaming) return null;
          const result = await renameScreen(renaming.id, name);
          if (!result.ok) return result.message;
          toast.success("已重新命名");
          return null;
        }}
      />

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>刪除策略</DialogTitle>
            <DialogDescription>確定要刪除「{removing?.name}」嗎？刪除後無法復原。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? "刪除中…" : "刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MemberGate>
  );
}
