"""選股快照：由公司、估值、季報（單季值）、月營收、股利計算每檔一列的指標。

指標定義（全部以百分比數字表示，例如 12.3 代表 12.3%）：
- eps_ttm：近四季單季 EPS 合計
- roe_ttm：近四季歸屬母公司淨利 ÷ 平均歸屬母公司權益（最新季與四季前的平均）
- roa_ttm：近四季淨利 ÷ 平均總資產
- 毛利率／營益率／淨利率：近四季合計計算，只適用一般業（ci），金融業為 None
- eps_yoy：最新單季 EPS 相對去年同季的成長率
- revenue_yoy_3m：近三個月營收合計相對去年同期的成長率
- 連續成長：從最新一期往回數，年增率持續為正的期數
- 股利：依「所屬年度」合計（季配息會加總四季）
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from ..parse import bounded

Quarter = tuple[int, int]
Month = tuple[int, int]


def prev_quarter(q: Quarter, n: int = 1) -> Quarter:
    year, quarter = q
    idx = year * 4 + (quarter - 1) - n
    return idx // 4, idx % 4 + 1


def prev_month(m: Month, n: int = 1) -> Month:
    year, month = m
    idx = year * 12 + (month - 1) - n
    return idx // 12, idx % 12 + 1


def pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator * 100


def growth(current: float | None, base: float | None) -> float | None:
    if current is None or base is None or base == 0:
        return None
    return (current - base) / abs(base) * 100


@dataclass
class SnapshotInputs:
    companies: list[dict[str, Any]]
    valuations: dict[str, dict[str, Any]] = field(default_factory=dict)  # code → 最新一筆
    quarters: dict[str, dict[Quarter, dict[str, Any]]] = field(default_factory=dict)
    revenues: dict[str, dict[Month, dict[str, Any]]] = field(default_factory=dict)
    dividends: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    today: date = field(default_factory=date.today)


def group_quarters(rows: Iterable[dict[str, Any]]) -> dict[str, dict[Quarter, dict[str, Any]]]:
    out: dict[str, dict[Quarter, dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(r["code"], {})[(int(r["year"]), int(r["quarter"]))] = r
    return out


def group_revenues(rows: Iterable[dict[str, Any]]) -> dict[str, dict[Month, dict[str, Any]]]:
    out: dict[str, dict[Month, dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(r["code"], {})[(int(r["year"]), int(r["month"]))] = r
    return out


# 當日的行情數字：只取最新一個有收盤價的交易日，不沿用舊資料（成交量沿用前一天會誤導）
QUOTE_FIELDS = ("close", "change", "volume", "trade_value")
# 估值：逐欄位取最近一筆有值的資料（某天缺估值或降級模式只有收盤價時，沿用最近的數值）
RATIO_FIELDS = ("pe", "pb", "dividend_yield")
AVG_VOLUME_DAYS = 20
AVG_VOLUME_MIN_DAYS = 10


def board_lot(total: int | None, odd: int | None, block: int | None = None) -> int | None:
    """一般看盤軟體的成交量 = 交易所公布的數字 − 零股 − 鉅額交易。

    上櫃沒有這兩個欄位：櫃買中心公布的成交量本來就不含零股與鉅額。
    """
    if total is None:
        return None
    return max(total - (odd or 0) - (block or 0), 0)


def latest_valuations(rows: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """每檔的最新行情、估值與近 20 個交易日平均成交量（整股）。trade_date 為最新一筆有收盤價的日期。"""
    by_code: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        r = {
            **r,
            "volume": board_lot(r.get("volume"), r.get("odd_volume"), r.get("block_volume")),
            "trade_value": board_lot(r.get("trade_value"), r.get("odd_trade_value"), r.get("block_trade_value")),
        }
        by_code.setdefault(r["code"], []).append(r)
    out: dict[str, dict[str, Any]] = {}
    for code, items in by_code.items():
        items.sort(key=lambda r: str(r["trade_date"]))
        merged: dict[str, Any] = {"code": code, "trade_date": items[-1]["trade_date"]}
        priced = [r for r in items if r.get("close") is not None]
        if priced:
            latest = priced[-1]
            merged["trade_date"] = latest["trade_date"]
            merged.update({f: latest.get(f) for f in QUOTE_FIELDS})
        for r in items:  # 由舊到新，新的值覆蓋舊的
            for f in RATIO_FIELDS:
                if r.get(f) is not None:
                    merged[f] = r[f]
        volumes = [r["volume"] for r in priced if r.get("volume") is not None][-AVG_VOLUME_DAYS:]
        merged["avg_volume_20d"] = round(sum(volumes) / len(volumes)) if len(volumes) >= AVG_VOLUME_MIN_DAYS else None
        out[code] = merged
    return out


def change_pct(close: float | None, change: float | None) -> float | None:
    """漲跌幅 = 漲跌 ÷ 前一日收盤價（收盤價 − 漲跌）。"""
    if close is None or change is None:
        return None
    previous = close - change
    return bounded(change / previous * 100) if previous > 0 else None


# ── 季報指標 ─────────────────────────────────────────────


def _ttm(qs: dict[Quarter, dict[str, Any]], latest: Quarter, key: str) -> float | None:
    values = [qs.get(prev_quarter(latest, i), {}).get(key) for i in range(4)]
    return None if any(v is None for v in values) else sum(values)  # type: ignore[arg-type]


def _avg(a: float | None, b: float | None) -> float | None:
    if a is None:
        return None
    return a if b is None else (a + b) / 2


def financial_metrics(qs: dict[Quarter, dict[str, Any]]) -> dict[str, Any]:
    if not qs:
        return {}
    latest = max(qs)
    cur = qs[latest]
    year_ago = qs.get(prev_quarter(latest, 4), {})
    is_general = cur.get("report_type") in ("ci", None)

    revenue_ttm = _ttm(qs, latest, "revenue")
    net_parent_ttm = _ttm(qs, latest, "net_income_parent")
    if net_parent_ttm is None:
        net_parent_ttm = _ttm(qs, latest, "net_income")
    equity_now = cur.get("equity_parent") or cur.get("equity")
    equity_prev = year_ago.get("equity_parent") or year_ago.get("equity")

    streak = 0
    q = latest
    while True:
        a, b = qs.get(q, {}).get("eps"), qs.get(prev_quarter(q, 4), {}).get("eps")
        if a is None or b is None or a <= b:
            break
        streak += 1
        q = prev_quarter(q)

    return {
        "financial_period": f"{latest[0]}Q{latest[1]}",
        "eps_ttm": bounded(_ttm(qs, latest, "eps")),
        "roe_ttm": bounded(pct(net_parent_ttm, _avg(equity_now, equity_prev))),
        "roa_ttm": bounded(
            pct(_ttm(qs, latest, "net_income"), _avg(cur.get("total_assets"), year_ago.get("total_assets")))
        ),
        "gross_margin": bounded(pct(_ttm(qs, latest, "gross_profit"), revenue_ttm)) if is_general else None,
        "operating_margin": bounded(pct(_ttm(qs, latest, "operating_income"), revenue_ttm)) if is_general else None,
        "net_margin": bounded(pct(_ttm(qs, latest, "net_income"), revenue_ttm)) if is_general else None,
        "eps_yoy": bounded(growth(cur.get("eps"), year_ago.get("eps"))),
        "eps_growth_quarters": streak,
        "debt_ratio": bounded(pct(cur.get("total_liabilities"), cur.get("total_assets"))),
        "current_ratio": bounded(pct(cur.get("current_assets"), cur.get("current_liabilities")))
        if is_general
        else None,
    }


# ── 月營收指標 ───────────────────────────────────────────


def revenue_metrics(ms: dict[Month, dict[str, Any]]) -> dict[str, Any]:
    if not ms:
        return {}
    latest = max(ms)
    cur = ms[latest]

    last3 = [ms.get(prev_month(latest, i)) for i in range(3)]
    yoy_3m = None
    if all(r and r.get("revenue") is not None and r.get("revenue_last_year") is not None for r in last3):
        yoy_3m = growth(sum(r["revenue"] for r in last3), sum(r["revenue_last_year"] for r in last3))  # type: ignore[index]

    streak = 0
    m = latest
    while (r := ms.get(m)) and r.get("yoy") is not None and r["yoy"] > 0:
        streak += 1
        m = prev_month(m)

    return {
        "revenue_period": f"{latest[0]}-{latest[1]:02d}",
        "revenue_mom": bounded(cur.get("mom")),
        "revenue_yoy": bounded(cur.get("yoy")),
        "revenue_cum_yoy": bounded(cur.get("cum_yoy")),
        "revenue_yoy_3m": bounded(yoy_3m),
        "revenue_growth_months": streak,
    }


# ── 股利指標 ─────────────────────────────────────────────


def latest_complete_fiscal_year(today: date) -> int:
    """上半年時去年度的股利多半尚未決議完成，以前年度為最近完整年度。"""
    return today.year - 1 if today.month >= 7 else today.year - 2


def dividend_metrics(records: list[dict[str, Any]], today: date, listed_year: int | None) -> dict[str, Any]:
    by_year: dict[int, float] = {}
    recent_cash = 0.0
    cutoff = today - timedelta(days=365)
    for r in records:
        cash = float(r.get("cash_dividend") or 0)
        by_year[int(r["fiscal_year"])] = by_year.get(int(r["fiscal_year"]), 0.0) + cash
        board = r.get("board_date")
        if board and date.fromisoformat(str(board)) >= cutoff:
            recent_cash += cash

    last_fy = latest_complete_fiscal_year(today)
    years = [y for y in range(last_fy - 4, last_fy + 1) if listed_year is None or y >= listed_year]
    avg_5y = sum(by_year.get(y, 0.0) for y in years) / len(years) if years else None

    streak = 0
    y = last_fy
    while by_year.get(y, 0.0) > 0:
        streak += 1
        y -= 1

    return {
        "cash_dividend_latest": round(recent_cash, 4),
        "cash_dividend_avg_5y": None if avg_5y is None else round(avg_5y, 4),
        "dividend_streak_years": streak,
    }


# ── 組合 ────────────────────────────────────────────────

SNAPSHOT_COLUMNS = [
    "code", "name", "market", "industry", "price_date", "financial_period", "revenue_period",
    "close", "change", "change_pct", "volume", "trade_value", "avg_volume_20d",
    "market_cap", "pe", "pb", "dividend_yield",
    "eps_ttm", "roe_ttm", "roa_ttm", "gross_margin", "operating_margin", "net_margin",
    "revenue_mom", "revenue_yoy", "revenue_cum_yoy", "revenue_yoy_3m", "eps_yoy",
    "revenue_growth_months", "eps_growth_quarters",
    "debt_ratio", "current_ratio",
    "cash_dividend_latest", "cash_dividend_avg_5y", "dividend_streak_years",
]  # fmt: skip


def build_snapshot(inp: SnapshotInputs) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for c in inp.companies:
        if not c.get("is_active", True):
            continue
        code = c["code"]
        v = inp.valuations.get(code, {})
        close = v.get("close")
        shares = c.get("shares_outstanding")
        listed = c.get("listed_at")
        row: dict[str, Any] = dict.fromkeys(SNAPSHOT_COLUMNS)
        row.update(
            {
                "code": code,
                "name": c["name"],
                "market": c["market"],
                "industry": c.get("industry"),
                "price_date": v.get("trade_date"),
                "close": close,
                "change": v.get("change"),
                "change_pct": change_pct(close, v.get("change")),
                "volume": v.get("volume"),
                "trade_value": v.get("trade_value"),
                "avg_volume_20d": v.get("avg_volume_20d"),
                "market_cap": round(close * shares) if close is not None and shares else None,
                "pe": v.get("pe"),
                "pb": v.get("pb"),
                "dividend_yield": v.get("dividend_yield"),
            }
        )
        row.update(financial_metrics(inp.quarters.get(code, {})))
        row.update(revenue_metrics(inp.revenues.get(code, {})))
        row.update(dividend_metrics(inp.dividends.get(code, []), inp.today, int(str(listed)[:4]) if listed else None))
        rows.append(row)
    return rows


class SanityError(RuntimeError):
    pass


def check_snapshot(rows: list[dict[str, Any]], *, min_rows: int = 1500) -> list[str]:
    """寫入前的合理性檢查；回傳問題清單（空清單代表通過）。"""
    problems: list[str] = []
    if len(rows) < min_rows:
        problems.append(f"只有 {len(rows)} 檔（預期至少 {min_rows}）")
        return problems
    with_price = sum(1 for r in rows if r.get("close") is not None)
    if with_price / len(rows) < 0.9:
        problems.append(f"有收盤價的只有 {with_price}/{len(rows)} 檔")
    with_eps = sum(1 for r in rows if r.get("eps_ttm") is not None)
    if with_eps / len(rows) < 0.7:
        problems.append(f"有近四季 EPS 的只有 {with_eps}/{len(rows)} 檔（季報資料可能不完整）")
    tsmc = next((r for r in rows if r["code"] == "2330"), None)
    if tsmc is None:
        problems.append("找不到 2330")
    elif not tsmc.get("eps_ttm") or tsmc["eps_ttm"] <= 0:
        problems.append(f"2330 的 eps_ttm 不合理：{tsmc.get('eps_ttm')}")
    return problems
