"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth/redirect";
import { signInWithGoogle, useAuth } from "@/lib/auth/session";

/** /auth/callback 失敗時帶回來的錯誤代碼。 */
const ERRORS: Record<string, string> = {
  callback: "登入沒有完成，請再試一次。",
  denied: "你取消了 Google 登入。",
};

export function LoginPanel() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const errorCode = params.get("error");
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? (ERRORS[errorCode] ?? ERRORS.callback!) : null,
  );

  // 已經登入：直接回到原本的頁面
  useEffect(() => {
    if (auth.status === "signedIn") router.replace(next as Route);
  }, [auth.status, next, router]);

  async function login() {
    setBusy(true);
    setError(null);
    const message = await signInWithGoogle(next);
    // 成功時瀏覽器會轉到 Google，不會回到這裡
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button size="lg" onClick={() => void login()} disabled={busy || auth.status !== "signedOut"}>
        <GoogleIcon />
        {busy ? "正在前往 Google…" : "使用 Google 帳號登入"}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
