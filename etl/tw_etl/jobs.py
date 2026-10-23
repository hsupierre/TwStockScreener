"""排程工作。每個工作完成資料寫入後都會重算快照（snapshot），讓前端盡快看到新資料。"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from .config import Settings
from .http import Fetcher
from .load.supabase import Supabase, in_filter
from .runs import Run, track_run
from .sources import finmind, mops, official, openapi, quotes
from .transform.financials import merge_statements, to_single_quarter
from .transform.snapshot import (
    SanityError,
    SnapshotInputs,
    build_snapshot,
    check_snapshot,
    group_quarters,
    group_revenues,
    latest_valuations,
)

log = logging.getLogger(__name__)

MARKETS: tuple[mops.Market, ...] = ("twse", "tpex")
VALUATION_RETENTION_DAYS = 3 * 366


@dataclass
class Context:
    db: Supabase
    fetcher: Fetcher
    settings: Settings
    dry_run: bool = False
    today: date = field(default_factory=date.today)

    def write(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> int:
        if self.dry_run:
            log.info("[dry-run] 略過寫入 %s：%d 列", table, len(rows))
            return len(rows)
        return self.db.upsert(table, rows, on_conflict=on_conflict)


def _known_codes(ctx: Context) -> set[str]:
    return {r["code"] for r in ctx.db.select_all("companies", select="code", order="code")}


def _only_known(rows: list[dict[str, Any]], known: set[str]) -> list[dict[str, Any]]:
    """外鍵限制：只寫入 companies 裡已有的代號（例如剛下市或尚未建檔的公司會被略過）。"""
    kept = [r for r in rows if r["code"] in known]
    if skipped := len(rows) - len(kept):
        log.info("略過 %d 列不在 companies 的資料", skipped)
    return kept


# ── daily：公司基本資料、行情、估值 ─────────────────────────

# 每個市場、每種資料的來源，依優先順序排列（日期相同時取前面的）
DAILY_SOURCES: dict[tuple[str, quotes.Kind], list[tuple[quotes.Source, Callable[[Fetcher], quotes.Partial]]]] = {
    ("twse", "quotes"): [("official", official.fetch_twse_quotes), ("openapi", openapi.fetch_twse_quotes)],
    ("twse", "valuations"): [("official", official.fetch_twse_valuations), ("openapi", openapi.fetch_twse_valuations)],
    ("tpex", "quotes"): [("official", official.fetch_tpex_quotes), ("openapi", openapi.fetch_tpex_quotes)],
    ("tpex", "valuations"): [("official", official.fetch_tpex_valuations), ("openapi", openapi.fetch_tpex_valuations)],
}
# 上市零股（證交所成交股數含零股，扣掉才是整股）；櫃買中心公布的本來就是整股
ODD_LOTS: Callable[[Fetcher, date | None], quotes.Partial] = official.fetch_twse_odd
# 上市鉅額交易（證交所成交股數含鉅額；一般看盤軟體的成交量不含）
BLOCK_TRADES: Callable[[Fetcher, date | None], quotes.Partial] = official.fetch_twse_block
# FinMind 免費額度有限，降級模式只補市值最大的這些股票
FINMIND_MAX_STOCKS = 300


def collect_market_daily(
    f: Fetcher, market: str
) -> tuple[quotes.Partial | None, quotes.Partial | None, dict[str, Any]]:
    """抓所有來源，各自挑出日期最新且筆數合理的行情與估值；回傳選擇結果與報告（寫入 etl_runs.details）。"""
    chosen: dict[str, quotes.Partial | None] = {}
    report: dict[str, Any] = {}
    for kind in ("quotes", "valuations"):
        candidates = [
            quotes.safe(market, kind, source, lambda fn=fn: fn(f))  # type: ignore[misc]
            for source, fn in DAILY_SOURCES[(market, kind)]
        ]
        pick = quotes.choose(candidates, quotes.MIN_ROWS[market])
        chosen[kind] = pick
        report[kind] = {
            "source": pick.source if pick else None,
            "date": pick.trade_date.isoformat() if pick and pick.trade_date else None,
            "candidates": [c.summary() for c in candidates],
        }
        log.info("%s %s → %s", market, kind, " / ".join(report[kind]["candidates"]))
    return chosen["quotes"], chosen["valuations"], report


def finmind_degraded(ctx: Context, market: str, known: set[str]) -> list[dict[str, Any]]:
    """官網與 OpenAPI 都失敗時，依上一份快照的市值排序，逐檔向 FinMind 補最新收盤價。"""
    ranked = ctx.db.select_all(
        "screen_snapshot",
        select="code,market_cap",
        order="market_cap.desc.nullslast,code",
        filters={"market": f"eq.{market}"},
    )
    codes = [r["code"] for r in ranked if r["code"] in known][:FINMIND_MAX_STOCKS]
    return finmind.fill_prices(ctx.fetcher, codes, ctx.today - timedelta(days=10), ctx.settings.finmind_token)


def run_daily(ctx: Context, *, snapshot: bool = True) -> None:
    with track_run(ctx.db, "daily", dry_run=ctx.dry_run) as run:
        companies = openapi.fetch_companies(ctx.fetcher)
        if len(companies) < 1500:
            raise SanityError(f"公司清單只有 {len(companies)} 家，資料來源可能異常")
        run.rows_written += ctx.write("companies", companies, "code")
        run.details["companies"] = len(companies)

        if not ctx.dry_run:
            # upsert 會觸發 updated_at；這次沒出現在清單中的公司（下市）updated_at 仍是舊的。
            # 預留 1 小時緩衝，避免本機與資料庫時鐘誤差把剛更新的公司誤判為下市。
            stale_before = run.started_at - timedelta(hours=1)
            ctx.db.update(
                "companies",
                {"updated_at": f"lt.{stale_before.isoformat()}", "is_active": "eq.true"},
                {"is_active": False},
            )

        known = {c["code"] for c in companies}
        daily: list[dict[str, Any]] = []
        for market in MARKETS:
            quote, valuation, report = collect_market_daily(ctx.fetcher, market)
            run.details[market] = report
            if quote is None:
                log.error("%s 行情：官網與 OpenAPI 都不可用，改用 FinMind 降級模式", market)
                filled = finmind_degraded(ctx, market, known)
                report["finmind"] = len(filled)
                run.details["degraded"] = True
                daily.extend(filled)
            adjustments: list[quotes.Partial] = []
            if market == "twse":  # 證交所成交股數含零股與鉅額；櫃買中心公布的本來就不含
                for kind, fn in (("odd", ODD_LOTS), ("block", BLOCK_TRADES)):
                    adj = quotes.safe(market, kind, "official", lambda fn=fn: fn(ctx.fetcher, None))  # type: ignore[misc]
                    report[kind] = adj.summary()
                    adjustments.append(adj)
            daily.extend(quotes.merge_daily(quote, valuation, *adjustments))
        daily = _only_known(daily, known)
        if not daily:
            raise SanityError("上市、上櫃行情都無法取得（官網、OpenAPI、FinMind 皆失敗）")
        run.rows_written += ctx.write("daily_valuation", daily, "code,trade_date")
        run.details["daily_valuation"] = len(daily)
        run.as_of = max(r["trade_date"] for r in daily).isoformat() if daily else None

        if not ctx.dry_run:
            cutoff = ctx.today - timedelta(days=VALUATION_RETENTION_DAYS)
            ctx.db.delete("daily_valuation", {"trade_date": f"lt.{cutoff.isoformat()}"})
    if snapshot:
        run_snapshot(ctx)


# ── monthly：最新月營收 ───────────────────────────────────


def run_monthly(ctx: Context) -> None:
    with track_run(ctx.db, "monthly", dry_run=ctx.dry_run) as run:
        rows = _only_known(openapi.fetch_monthly_revenue(ctx.fetcher), _known_codes(ctx))
        run.rows_written = ctx.write("monthly_revenue", rows, "code,year,month")
        if rows:
            y, m = max((r["year"], r["month"]) for r in rows)
            run.as_of = f"{y}-{m:02d}"
    run_snapshot(ctx)


def load_revenue_history(ctx: Context, run: Run, months: list[tuple[int, int]]) -> None:
    known = _known_codes(ctx)
    for year, month in months:
        rows: list[dict[str, Any]] = []
        for market in MARKETS:
            rows.extend(mops.fetch_revenue_month(ctx.fetcher, market, year, month))
        run.rows_written += ctx.write("monthly_revenue", _only_known(rows, known), "code,year,month")
        if rows:
            run.as_of = max(run.as_of or "", f"{year}-{month:02d}")


# ── quarterly：季報（MOPS）────────────────────────────────


def available_quarters(today: date, years: list[int]) -> list[tuple[int, int]]:
    """只抓已經結束的季別（例如 10 月時，當年只抓到 Q3）。"""
    current = (today.year, (today.month - 1) // 3 + 1)
    return [(y, q) for y in years for q in range(1, 5) if (y, q) < current]


def representative_quarter(counts: dict[tuple[int, int], int], min_share: float = 0.5) -> tuple[int, int] | None:
    """整體資料基準：已公布家數達到最多那季一半以上的最新一季。

    季報公告期限前會有少數公司提早公布（例如 10 月時只有 5 家公布 Q3），不能因此宣稱資料已更新到該季。
    """
    if not counts:
        return None
    threshold = max(counts.values()) * min_share
    eligible = [q for q, n in counts.items() if n > 0 and n >= threshold]
    return max(eligible) if eligible else None


def load_quarters(ctx: Context, run: Run, years: list[int]) -> None:
    known = _known_codes(ctx)
    report_types: dict[str, str] = {}
    counts: dict[tuple[int, int], int] = {}
    for year in sorted(set(years)):
        cumulative: dict = {}
        for _, quarter in available_quarters(ctx.today, [year]):
            stmts: dict[str, list[mops.StatementRow]] = {"income": [], "balance": [], "cashflow": []}
            for market in MARKETS:
                for report in stmts:
                    stmts[report].extend(mops.fetch_statement(ctx.fetcher, report, market, year, quarter))  # type: ignore[arg-type]
            run.details[f"{year}Q{quarter}"] = counts[(year, quarter)] = len(stmts["income"])
            if not stmts["income"]:
                log.info("%dQ%d 尚無資料", year, quarter)
                continue
            cumulative.update(merge_statements(year, quarter, stmts["income"], stmts["balance"], stmts["cashflow"]))
        rows = _only_known(to_single_quarter(cumulative), known)
        run.rows_written += ctx.write("financials_quarterly", rows, "code,year,quarter")
        report_types.update({r["code"]: r["report_type"] for r in rows if r["report_type"]})

    if report_types and not ctx.dry_run:
        by_type: dict[str, list[str]] = {}
        for code, rt in report_types.items():
            by_type.setdefault(rt, []).append(code)
        for rt, codes in by_type.items():
            for i in range(0, len(codes), 400):  # 避免 URL 過長
                ctx.db.update("companies", {"code": in_filter(codes[i : i + 400])}, {"report_type": rt})
    if latest := representative_quarter(counts):
        run.as_of = f"{latest[0]}Q{latest[1]}"


def run_quarterly(ctx: Context, years: list[int] | None = None) -> None:
    years = years or [ctx.today.year - 1, ctx.today.year]
    with track_run(ctx.db, "quarterly", dry_run=ctx.dry_run) as run:
        load_quarters(ctx, run, years)
        run.details["years"] = years
    run_snapshot(ctx)


# ── dividend：股利分派（MOPS）──────────────────────────────


def load_dividends(ctx: Context, run: Run, board_years: list[int]) -> None:
    known = _known_codes(ctx)
    for year in sorted(set(board_years)):
        rows: list[dict[str, Any]] = []
        for market in MARKETS:
            rows.extend(mops.fetch_dividends(ctx.fetcher, market, year))
        # 同一期間跨市場重複時（轉上市），以後出現者為準
        dedup = {(r["code"], r["fiscal_year"], r["period"]): r for r in rows}
        run.rows_written += ctx.write("dividends", _only_known(list(dedup.values()), known), "code,fiscal_year,period")
    run.as_of = ctx.today.isoformat()


def run_dividends(ctx: Context, board_years: list[int] | None = None) -> None:
    board_years = board_years or [ctx.today.year - 1, ctx.today.year]
    with track_run(ctx.db, "dividend", dry_run=ctx.dry_run) as run:
        load_dividends(ctx, run, board_years)
        run.details["board_years"] = board_years
    run_snapshot(ctx)


# ── snapshot ──────────────────────────────────────────────


def load_snapshot_inputs(ctx: Context) -> SnapshotInputs:
    db = ctx.db
    companies = db.select_all(
        "companies",
        select="code,name,market,industry,report_type,shares_outstanding,listed_at,is_active",
        order="code",
    )
    latest = db.select_all("daily_valuation", select="trade_date", order="trade_date.desc", filters={"limit": "1"})
    valuations: list[dict[str, Any]] = []
    if latest:
        # 35 天約 24 個交易日：足夠計算 20 日均量，也能在缺資料時往回找估值
        since = date.fromisoformat(latest[0]["trade_date"]) - timedelta(days=35)
        valuations = db.select_all(
            "daily_valuation",
            select="code,trade_date,close,change,volume,trade_value,odd_volume,odd_trade_value,"
            "block_volume,block_trade_value,pe,pb,dividend_yield",
            order="code,trade_date",
            filters={"trade_date": f"gte.{since.isoformat()}"},
        )
    since_year = ctx.today.year - 4
    quarters = db.select_all("financials_quarterly", order="code,year,quarter", filters={"year": f"gte.{since_year}"})
    revenues = db.select_all(
        "monthly_revenue",
        select="code,year,month,revenue,revenue_last_year,mom,yoy,cum_yoy",
        order="code,year,month",
        filters={"year": f"gte.{since_year}"},
    )
    dividends = db.select_all(
        "dividends", order="code,fiscal_year,period", filters={"fiscal_year": f"gte.{ctx.today.year - 12}"}
    )
    by_code: dict[str, list[dict[str, Any]]] = {}
    for d in dividends:
        by_code.setdefault(d["code"], []).append(d)
    return SnapshotInputs(
        companies=companies,
        valuations=latest_valuations(valuations),
        quarters=group_quarters(quarters),
        revenues=group_revenues(revenues),
        dividends=by_code,
        today=ctx.today,
    )


def run_snapshot(ctx: Context) -> None:
    with track_run(ctx.db, "snapshot", dry_run=ctx.dry_run) as run:
        rows = build_snapshot(load_snapshot_inputs(ctx))
        if problems := check_snapshot(rows):
            run.details["problems"] = problems
            raise SanityError("快照未通過合理性檢查，保留線上舊資料：" + "；".join(problems))
        stamp = datetime.now(UTC)
        for r in rows:
            r["updated_at"] = stamp
        run.rows_written = ctx.write("screen_snapshot", rows, "code")
        if not ctx.dry_run:  # 移除這次沒有出現的股票（下市）
            ctx.db.delete("screen_snapshot", {"updated_at": f"lt.{stamp.isoformat()}"})
        dates = [r["price_date"] for r in rows if r.get("price_date")]
        run.as_of = str(max(dates)) if dates else ctx.today.isoformat()
    revalidate(ctx)


def revalidate(ctx: Context) -> None:
    """通知 Next.js 讓快取失效（P5 部署後才會設定 NEXT_PUBLIC_SITE_URL 與 REVALIDATE_SECRET）。"""
    s = ctx.settings
    if ctx.dry_run or not s.site_url or not s.revalidate_secret:
        return
    try:
        resp = httpx.post(
            f"{s.site_url}/api/revalidate",
            json={"tags": ["snapshot"]},
            headers={"Authorization": f"Bearer {s.revalidate_secret}"},
            timeout=30,
        )
        log.info("revalidate → HTTP %d", resp.status_code)
    except httpx.HTTPError as e:  # 快取失效失敗不影響資料正確性，下次 ISR 週期會自動更新
        log.warning("revalidate 失敗：%s", e)


# ── 歷史收盤行情（20 日均量需要）───────────────────────────

HISTORY_QUOTES: dict[str, Callable[[Fetcher, date], quotes.Partial]] = {
    "twse": official.fetch_twse_quotes_on,
    "tpex": official.fetch_tpex_quotes_on,
}


def load_price_history(ctx: Context, run: Run, days: int) -> None:
    """回補最近 days 個日曆天的收盤行情（只有行情，不含估值）；非交易日自動略過。"""
    for host in ("www.twse.com.tw", "www.tpex.org.tw"):
        ctx.fetcher.set_min_interval(host, 2.0)  # 回補時放慢，對官網比較禮貌
    known = _known_codes(ctx)
    trading_days: list[str] = []
    for offset in range(days, 0, -1):
        day = ctx.today - timedelta(days=offset)
        if day.weekday() >= 5:
            continue
        rows: list[dict[str, Any]] = []
        for market in MARKETS:
            part = quotes.safe(market, "quotes", "official", lambda m=market, d=day: HISTORY_QUOTES[m](ctx.fetcher, d))
            if part.error or len(part.rows) < quotes.MIN_ROWS[market]:
                log.info("%s %s 略過（%s）", day, market, part.error or f"只有 {len(part.rows)} 筆")
                continue
            adjustments: list[quotes.Partial] = []
            if market == "twse":
                for kind, fn in (("odd", ODD_LOTS), ("block", BLOCK_TRADES)):
                    adjustments.append(
                        quotes.safe(market, kind, "official", lambda fn=fn, d=day: fn(ctx.fetcher, d))  # type: ignore[misc]
                    )
            rows.extend(quotes.merge_daily(part, None, *adjustments))
        if rows:
            run.rows_written += ctx.write("daily_valuation", _only_known(rows, known), "code,trade_date")
            trading_days.append(day.isoformat())
    run.details["trading_days"] = len(trading_days)
    run.as_of = trading_days[-1] if trading_days else None


# ── backfill：一次性歷史回補 ─────────────────────────────


def run_backfill(
    ctx: Context,
    *,
    from_year: int,
    revenue_months: int,
    dividend_years: int,
    steps: set[str],
    price_days: int = 45,
) -> None:
    if "daily" in steps:
        run_daily(ctx, snapshot=False)
    if "quarterly" in steps:
        with track_run(ctx.db, "backfill-quarterly", dry_run=ctx.dry_run) as run:
            load_quarters(ctx, run, list(range(from_year, ctx.today.year + 1)))
    if "revenue" in steps:
        with track_run(ctx.db, "backfill-revenue", dry_run=ctx.dry_run) as run:
            latest = (ctx.today.year, ctx.today.month)
            months = []
            for i in range(1, revenue_months + 1):  # 上個月往回推
                idx = latest[0] * 12 + latest[1] - 1 - i
                months.append((idx // 12, idx % 12 + 1))
            load_revenue_history(ctx, run, sorted(months))
    if "prices" in steps:
        with track_run(ctx.db, "backfill-prices", dry_run=ctx.dry_run) as run:
            load_price_history(ctx, run, price_days)
    if "dividend" in steps:
        with track_run(ctx.db, "backfill-dividend", dry_run=ctx.dry_run) as run:
            load_dividends(ctx, run, list(range(ctx.today.year - dividend_years + 1, ctx.today.year + 1)))
    run_snapshot(ctx)
