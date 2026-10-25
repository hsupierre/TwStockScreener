"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { createStore } from "@/lib/member/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { safeNext } from "./redirect";

/**
 * 登入狀態只在瀏覽器端處理（不用 proxy）：
 * - 頁面維持靜態、從 CDN 提供；伺服器不讀 session，也就不需要每次請求都刷新 token。
 * - 會員資料由 Supabase RLS 保護（只能讀寫自己的），瀏覽器端 client 會自動刷新 token。
 * - 唯一在伺服器讀 session 的是 /auth/callback（交換登入碼）與刪除帳號。
 */

export interface Member {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export type AuthState =
  { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; member: Member };

const LOADING: AuthState = { status: "loading" };
const auth = createStore<AuthState>(LOADING);
let started = false;

export function toMember(user: User): Member {
  const meta = user.user_metadata as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: user.id,
    email: user.email ?? null,
    name: text(meta.full_name) ?? text(meta.name),
    avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
  };
}

function apply(session: Session | null) {
  const prev = auth.get();
  if (!session) {
    if (prev.status !== "signedOut") auth.set({ status: "signedOut" });
    return;
  }
  const member = toMember(session.user);
  // token 刷新時 user 沒變，不要觸發重新渲染與重新載入資料
  if (prev.status === "signedIn" && JSON.stringify(prev.member) === JSON.stringify(member)) return;
  auth.set({ status: "signedIn", member });
}

function start() {
  if (started) return;
  started = true;
  // 訂閱時會立即收到 INITIAL_SESSION（從 cookie 讀取，必要時先刷新 token）
  createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => apply(session));
}

export function subscribeAuth(listener: () => void) {
  start();
  return auth.subscribe(listener);
}

export const getAuthState = auth.get;

/** 伺服器與 hydration 時一律是 loading，避免與實際狀態不一致。 */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, auth.get, () => LOADING);
}

export async function signInWithGoogle(next: string): Promise<string | null> {
  const redirectTo = new URL("/auth/callback", window.location.origin);
  redirectTo.searchParams.set("next", safeNext(next));
  const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() },
  });
  return error ? "無法連線到 Google 登入，請稍後再試" : null;
}

export async function signOut(): Promise<void> {
  // 即使網路失敗，scope: "local" 也會清掉這台裝置的 session
  await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
  apply(null);
}

/** 測試用：重設模組狀態。 */
export function resetAuthForTest() {
  started = false;
  auth.set(LOADING);
}
