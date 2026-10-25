/**
 * 單元測試用的瀏覽器端 Supabase client（記憶體資料表，不連網路）。
 * 只實作會員功能用到的部分：auth 事件、select/insert/update/delete、eq、order、single、rpc。
 * vitest.setup.ts 會把 `@/lib/supabase/client` 換成這個。
 */
import type { Session, User } from "@supabase/supabase-js";
import { vi } from "vitest";

type Row = Record<string, unknown>;
type AuthCallback = (event: string, session: Session | null) => void;
export interface FakeError {
  message: string;
  code?: string;
  hint?: string | null;
}

export const fake = {
  session: null as Session | null,
  tables: {} as Record<string, Row[]>,
  /** 下一個資料表操作回傳的錯誤（用一次就清除） */
  nextError: null as FakeError | null,
  listeners: [] as AuthCallback[],
  seq: 0,
  rpc: vi.fn(async (_fn: string): Promise<{ data: null; error: FakeError | null }> => ({
    data: null,
    error: null,
  })),
  signInWithOAuth: vi.fn(async (_opts: unknown) => ({ data: {}, error: null as FakeError | null })),

  reset() {
    this.session = null;
    this.tables = { watchlist_items: [], saved_screens: [] };
    this.nextError = null;
    this.listeners = [];
    this.seq = 0;
    this.rpc.mockClear();
    this.signInWithOAuth.mockClear();
  },

  /** 模擬登入完成（觸發 SIGNED_IN）。 */
  signIn(user: Partial<User> & { id: string }) {
    this.session = { user: { user_metadata: {}, ...user } as User } as Session;
    for (const cb of this.listeners) cb("SIGNED_IN", this.session);
  },
};

class Query implements PromiseLike<{ data: unknown; error: FakeError | null }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private filters: [string, unknown][] = [];
  private orderBy: string | null = null;
  private returning = false;
  private one = false;

  constructor(private table: string) {}

  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string) {
    this.orderBy = column;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }

  private run(): { data: unknown; error: FakeError | null } {
    if (fake.nextError) {
      const error = fake.nextError;
      fake.nextError = null;
      return { data: null, error };
    }
    const userId = fake.session?.user.id;
    if (!userId) return { data: null, error: { message: "permission denied", code: "42501" } };
    const rows = (fake.tables[this.table] ??= []);
    // RLS：只看得到自己的資料
    const match = (r: Row) => r.user_id === userId && this.filters.every(([k, v]) => r[k] === v);

    let result: Row[];
    if (this.op === "insert") {
      fake.seq += 1;
      const row: Row = {
        id: `id-${fake.seq}`,
        user_id: userId,
        created_at: new Date(Date.UTC(2026, 9, 25, 0, 0, fake.seq)).toISOString(),
        updated_at: new Date(Date.UTC(2026, 9, 25, 0, 0, fake.seq)).toISOString(),
        ...this.payload,
      };
      if (this.table === "watchlist_items" && rows.some((r) => r.user_id === userId && r.code === row.code)) {
        return { data: null, error: { message: "duplicate key", code: "23505" } };
      }
      rows.push(row);
      result = [row];
    } else if (this.op === "update") {
      result = rows.filter(match);
      for (const r of result) Object.assign(r, this.payload);
    } else if (this.op === "delete") {
      result = rows.filter(match);
      fake.tables[this.table] = rows.filter((r) => !match(r));
    } else {
      result = rows.filter(match);
      if (this.orderBy) {
        const key = this.orderBy;
        result = [...result].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
      }
    }

    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    if (this.one) {
      return result.length === 1
        ? { data: { ...result[0] }, error: null }
        : { data: null, error: { message: "no rows", code: "PGRST116" } };
    }
    return { data: result.map((r) => ({ ...r })), error: null };
  }

  then<A = { data: unknown; error: FakeError | null }, B = never>(
    onfulfilled?: ((value: { data: unknown; error: FakeError | null }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

export function createFakeSupabaseClient() {
  return {
    auth: {
      onAuthStateChange(cb: AuthCallback) {
        fake.listeners.push(cb);
        // 真實 client 也是非同步送出 INITIAL_SESSION
        queueMicrotask(() => cb("INITIAL_SESSION", fake.session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {
        fake.session = null;
        for (const cb of fake.listeners) cb("SIGNED_OUT", null);
        return { error: null };
      },
      signInWithOAuth: (opts: unknown) => fake.signInWithOAuth(opts),
    },
    from: (table: string) => new Query(table),
    rpc: (fn: string) => fake.rpc(fn),
  };
}
