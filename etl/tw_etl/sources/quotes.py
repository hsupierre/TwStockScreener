"""每日行情與估值的多來源選擇。

每個市場（上市、上櫃）分別抓「行情」（收盤價等）與「估值」（本益比等），每種都有兩個來源：
  official：證交所／櫃買中心官網 JSON（通常比 OpenAPI 早一天更新）
  openapi ：證交所／櫃買中心 OpenAPI
兩個來源都抓，取「日期最新、筆數合理」的那個；日期相同時優先 official。
都失敗時由 jobs 改用 FinMind 降級模式（只補市值較大的股票收盤價）。
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

from ..http import FetchError
from ..parse import is_common_stock

log = logging.getLogger(__name__)

Source = Literal["official", "openapi", "finmind"]
Kind = Literal["quotes", "valuations"]
PRIORITY: dict[str, int] = {"official": 0, "openapi": 1, "finmind": 2}

# 合理的最少筆數（一般股票）：上市約 1,050、上櫃約 880 檔
MIN_ROWS: dict[str, int] = {"twse": 900, "tpex": 700}

QUOTE_FIELDS = ("close", "change", "volume", "trade_value")
VALUATION_FIELDS = ("pe", "pb", "dividend_yield")


@dataclass
class Partial:
    """某市場、某來源的行情或估值，只保留同一個交易日的資料。"""

    market: str
    kind: Kind
    source: Source
    trade_date: date | None = None
    rows: dict[str, dict[str, Any]] = field(default_factory=dict)  # 代號 → 欄位
    error: str | None = None

    def summary(self) -> str:
        if self.error:
            return f"{self.source}: 失敗（{self.error[:120]}）"
        return f"{self.source}: {self.trade_date} {len(self.rows)} 筆"


def from_rows(
    market: str, kind: Kind, source: Source, items: Iterable[tuple[str | None, date | None, dict]]
) -> Partial:
    """把（代號, 日期, 欄位）轉成 Partial：只保留一般股票、最新一個交易日；空值欄位不保留。"""
    by_date: dict[date, dict[str, dict[str, Any]]] = {}
    for code, day, values in items:
        if not is_common_stock(code) or day is None:
            continue
        clean = {k: v for k, v in values.items() if v is not None}
        if clean:
            by_date.setdefault(day, {})[code.strip()] = clean  # type: ignore[union-attr]
    if not by_date:
        return Partial(market, kind, source, error="沒有可用的資料")
    latest = max(by_date)
    return Partial(market, kind, source, trade_date=latest, rows=by_date[latest])


def safe(market: str, kind: Kind, source: Source, fn: Callable[[], Partial]) -> Partial:
    """單一來源失敗不影響其他來源：把例外轉成 Partial.error。"""
    try:
        return fn()
    except (FetchError, ValueError, KeyError, IndexError, TypeError) as e:
        log.warning("%s %s %s 失敗：%s", market, kind, source, e)
        return Partial(market, kind, source, error=f"{type(e).__name__}: {e}")


def choose(candidates: Iterable[Partial], min_rows: int) -> Partial | None:
    """日期最新且筆數 ≥ min_rows 的來源；日期相同時依 PRIORITY（official 優先）。"""
    valid = [c for c in candidates if not c.error and c.trade_date and len(c.rows) >= min_rows]
    if not valid:
        return None
    return max(valid, key=lambda c: (c.trade_date, -PRIORITY[c.source]))


def merge_daily(quotes: Partial | None, valuations: Partial | None) -> list[dict[str, Any]]:
    """合併成 daily_valuation 的列，以（代號, 日期）為 key；source 記錄收盤價來源。

    行情與估值日期不同時各自成列；快照計算會對每個欄位取最近一筆有值的資料。
    """
    rows: dict[tuple[str, date], dict[str, Any]] = {}
    for part in (quotes, valuations):
        if part is None or part.trade_date is None:
            continue
        for code, values in part.rows.items():
            row = rows.setdefault((code, part.trade_date), {"code": code, "trade_date": part.trade_date})
            row.update(values)
            if part.kind == "quotes" or "source" not in row:
                row["source"] = part.source
    return list(rows.values())
