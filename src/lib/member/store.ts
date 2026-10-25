/** 最小的外部狀態容器，給 useSyncExternalStore 使用（登入狀態、自選股、我的策略）。 */
export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Supabase／PostgREST 錯誤轉成給使用者看的訊息。 */
export function memberErrorMessage(
  error: { message?: string; hint?: string | null; code?: string } | null,
  limit = "已達上限",
): string {
  if (error?.hint === "member_limit") return limit;
  // PGRST301：JWT 過期或無效；42501：沒有權限（通常是 session 已失效，被當成匿名）
  if (error?.code === "PGRST301" || error?.code === "42501") return "登入已過期，請重新登入";
  return "操作失敗，請稍後再試";
}
