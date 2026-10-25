"use client";

import { useSyncExternalStore } from "react";

import { getAuthState, subscribeAuth } from "@/lib/auth/session";

import { createStore } from "./store";

/** idle：未登入；loading：讀取中；ready：已載入；error：讀取失敗 */
export type ResourceStatus = "idle" | "loading" | "ready" | "error";

export interface ResourceState<T> {
  status: ResourceStatus;
  userId: string | null;
  data: T;
}

/**
 * 屬於登入使用者的資料（自選股、我的策略）：登入時讀取、登出或換帳號時清空。
 * 第一次有元件訂閱時才開始跟隨登入狀態，所以沒用到的頁面不會發出請求。
 */
export function createMemberResource<T>(
  empty: T,
  fetch: () => PromiseLike<{ data: T | null; error: unknown }>,
) {
  const idle: ResourceState<T> = { status: "idle", userId: null, data: empty };
  const store = createStore<ResourceState<T>>(idle);
  let linked = false;

  async function load(userId: string) {
    store.set({ status: "loading", userId, data: empty });
    const { data, error } = await fetch();
    if (store.get().userId !== userId) return; // 讀取期間已登出或換帳號
    store.set(
      error || data === null ? { status: "error", userId, data: empty } : { status: "ready", userId, data },
    );
  }

  function syncWithAuth() {
    const auth = getAuthState();
    const userId = auth.status === "signedIn" ? auth.member.id : null;
    if (userId === store.get().userId) return;
    if (userId) void load(userId);
    else store.set(idle);
  }

  function subscribe(listener: () => void) {
    if (!linked) {
      linked = true;
      subscribeAuth(syncWithAuth);
      syncWithAuth();
    }
    return store.subscribe(listener);
  }

  return {
    store,
    use: () => useSyncExternalStore(subscribe, store.get, () => idle),
    /** 已載入時回傳目前狀態與使用者 id，否則 null（未登入或讀取中不能修改）。 */
    ready: () => {
      const s = store.get();
      return s.status === "ready" && s.userId ? { ...s, userId: s.userId } : null;
    },
    reload: () => {
      const { userId } = store.get();
      if (userId) void load(userId);
    },
    resetForTest: () => {
      linked = false;
      store.set(idle);
    },
  };
}
