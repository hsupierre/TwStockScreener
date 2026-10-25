"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut, useAuth } from "@/lib/auth/session";
import { memberErrorMessage } from "@/lib/member/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { MemberGate } from "./member-gate";

export function AccountView() {
  const auth = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().rpc("delete_my_account");
    if (error) {
      setBusy(false);
      toast.error(memberErrorMessage(error));
      return;
    }
    await signOut();
    toast.success("帳號與所有資料已刪除");
    router.push("/");
  }

  return (
    <MemberGate status={auth.status === "signedIn" ? "ready" : "loading"} onRetry={() => {}} what="帳號設定">
      {auth.status === "signedIn" && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>基本資料</CardTitle>
              <CardDescription>來自你的 Google 帳號，本站不會取得你的密碼。</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">名稱</dt>
                <dd>{auth.member.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{auth.member.email ?? "—"}</dd>
                <dt className="text-muted-foreground">登入方式</dt>
                <dd>Google</dd>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>刪除帳號</CardTitle>
              <CardDescription>帳號、自選股與我的策略會永久刪除，無法復原。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                刪除我的帳號
              </Button>
            </CardContent>
          </Card>

          <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>確定要刪除帳號嗎？</DialogTitle>
                <DialogDescription>
                  {auth.member.email ?? "此帳號"}的自選股與我的策略都會永久刪除。之後仍可用同一個 Google
                  帳號重新登入，但會是全新的帳號。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={busy}>
                    取消
                  </Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => void deleteAccount()} disabled={busy}>
                  {busy ? "刪除中…" : "永久刪除"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </MemberGate>
  );
}
