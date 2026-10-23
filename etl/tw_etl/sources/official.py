"""證交所／櫃買中心官網的每日行情與估值（不帶日期時回傳最新交易日）。

與 OpenAPI 是同一份資料、相同定義，但通常更早更新（例如晚上 OpenAPI 還是前一天、官網已是當天）。
  上市行情：twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL（固定回傳 CSV）
  上市估值：twse.com.tw/rwd/zh/afterTrading/BWIBBU_d（JSON）
  上櫃行情：tpex.org.tw/www/zh-tw/afterTrading/otc（JSON）
  上櫃估值：tpex.org.tw/www/zh-tw/afterTrading/peQryDate（JSON）
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date
from typing import Any

from ..http import Fetcher
from ..parse import ad_date, normalize_header, positive_or_none, roc_date, to_float, to_int
from .quotes import Partial, from_rows

TWSE_WEB = "https://www.twse.com.tw/rwd/zh/afterTrading"
TPEX_WEB = "https://www.tpex.org.tw/www/zh-tw/afterTrading"


def _index(fields: list[str]) -> dict[str, int]:
    """欄位名稱 → 位置；名稱先移除空白與 <br> 等標籤（櫃買的欄位名稱常帶多餘空白）。"""
    out: dict[str, int] = {}
    for i, name in enumerate(fields):
        key = normalize_header(name.split("<")[0])
        out.setdefault(key, i)
    return out


def _get(row: list[Any], idx: dict[str, int], *names: str) -> Any:
    for n in names:
        i = idx.get(normalize_header(n))
        if i is not None and i < len(row):
            return row[i]
    return None


# ── 上市 ─────────────────────────────────────────────────


def parse_twse_quotes(text: str) -> Partial:
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    if not rows or "證券代號" not in [c.strip() for c in rows[0]]:
        raise ValueError(f"證交所行情格式不符：{text[:120]!r}")
    idx = _index(rows[0])
    items = (
        (
            _get(r, idx, "證券代號"),
            roc_date(_get(r, idx, "日期")),
            {
                "close": positive_or_none(_get(r, idx, "收盤價")),
                "change": to_float(_get(r, idx, "漲跌價差")),
                "volume": to_int(_get(r, idx, "成交股數")),
                "trade_value": to_int(_get(r, idx, "成交金額")),
            },
        )
        for r in rows[1:]
        if len(r) >= len(rows[0])
    )
    return from_rows("twse", "quotes", "official", items)


def parse_twse_valuations(data: dict[str, Any]) -> Partial:
    if str(data.get("stat", "")).upper() != "OK":
        raise ValueError(f"證交所估值回應異常：stat={data.get('stat')!r}")
    day = ad_date(data.get("date"))
    idx = _index(data["fields"])
    items = (
        (
            str(_get(r, idx, "證券代號") or ""),
            day,
            {
                "pe": positive_or_none(_get(r, idx, "本益比")),
                "pb": positive_or_none(_get(r, idx, "股價淨值比")),
                "dividend_yield": to_float(_get(r, idx, "殖利率(%)")),
            },
        )
        for r in data["data"]
    )
    return from_rows("twse", "valuations", "official", items)


def _sign(cell: Any) -> int:
    """MI_INDEX 的「漲跌(+/-)」是 HTML，例如 <p style= color:red>+</p>；價差欄只有絕對值。"""
    text = re.sub(r"<[^>]+>", "", str(cell or "")).strip()
    return -1 if text.startswith("-") else 1


def parse_twse_mi_index(data: dict[str, Any]) -> Partial:
    """MI_INDEX（type=ALLBUT0999）：可以指定日期查詢歷史收盤行情，用於回補。"""
    if str(data.get("stat", "")).upper() != "OK":
        raise ValueError(f"證交所 MI_INDEX 沒有資料：stat={data.get('stat')!r}")
    table = next(
        (t for t in data.get("tables", []) if {"證券代號", "收盤價"} <= set(t.get("fields") or [])),
        None,
    )
    if table is None:
        raise ValueError("證交所 MI_INDEX 找不到每日收盤行情表")
    day = ad_date(data.get("date"))
    idx = _index(table["fields"])
    items = []
    for r in table["data"]:
        magnitude = to_float(_get(r, idx, "漲跌價差"))
        items.append(
            (
                str(_get(r, idx, "證券代號") or ""),
                day,
                {
                    "close": positive_or_none(_get(r, idx, "收盤價")),
                    "change": None if magnitude is None else _sign(_get(r, idx, "漲跌(+/-)")) * magnitude,
                    "volume": to_int(_get(r, idx, "成交股數")),
                    "trade_value": to_int(_get(r, idx, "成交金額")),
                },
            )
        )
    return from_rows("twse", "quotes", "official", items)


def fetch_twse_quotes_on(f: Fetcher, day: date) -> Partial:
    """指定日期的上市收盤行情（STOCK_DAY_ALL 會忽略日期參數，所以改用 MI_INDEX）。"""
    return parse_twse_mi_index(
        f.get_json(
            f"{TWSE_WEB}/MI_INDEX", params={"date": day.strftime("%Y%m%d"), "type": "ALLBUT0999", "response": "json"}
        )
    )


def fetch_twse_quotes(f: Fetcher) -> Partial:
    return parse_twse_quotes(f.get_text(f"{TWSE_WEB}/STOCK_DAY_ALL?response=json", encoding="utf-8"))


def fetch_twse_valuations(f: Fetcher) -> Partial:
    return parse_twse_valuations(f.get_json(f"{TWSE_WEB}/BWIBBU_d", params={"response": "json", "selectType": "ALL"}))


# ── 上櫃 ─────────────────────────────────────────────────


def _tpex_table(data: dict[str, Any]) -> tuple[date | None, dict[str, int], list[list[Any]]]:
    if str(data.get("stat", "")).lower() != "ok" or not data.get("tables"):
        raise ValueError(f"櫃買回應異常：stat={data.get('stat')!r}")
    table = data["tables"][0]
    day = roc_date(table.get("date")) or ad_date(data.get("date"))
    return day, _index(table["fields"]), table["data"]


def parse_tpex_quotes(data: dict[str, Any]) -> Partial:
    day, idx, rows = _tpex_table(data)
    items = (
        (
            str(_get(r, idx, "代號") or ""),
            day,
            {
                "close": positive_or_none(_get(r, idx, "收盤")),
                "change": to_float(_get(r, idx, "漲跌")),
                "volume": to_int(_get(r, idx, "成交股數")),
                "trade_value": to_int(_get(r, idx, "成交金額(元)", "成交金額")),
            },
        )
        for r in rows
    )
    return from_rows("tpex", "quotes", "official", items)


def parse_tpex_valuations(data: dict[str, Any]) -> Partial:
    day, idx, rows = _tpex_table(data)
    items = (
        (
            str(_get(r, idx, "股票代號") or ""),
            day,
            {
                "pe": positive_or_none(_get(r, idx, "本益比")),
                "pb": positive_or_none(_get(r, idx, "股價淨值比")),
                "dividend_yield": to_float(_get(r, idx, "殖利率(%)")),
            },
        )
        for r in rows
    )
    return from_rows("tpex", "valuations", "official", items)


def fetch_tpex_quotes(f: Fetcher) -> Partial:
    return parse_tpex_quotes(f.get_json(f"{TPEX_WEB}/otc", params={"type": "EW", "response": "json"}))


def fetch_tpex_quotes_on(f: Fetcher, day: date) -> Partial:
    """指定日期的上櫃收盤行情；非交易日回傳 0 筆（Partial.error）。"""
    return parse_tpex_quotes(
        f.get_json(f"{TPEX_WEB}/otc", params={"date": day.strftime("%Y/%m/%d"), "type": "EW", "response": "json"})
    )


def fetch_tpex_valuations(f: Fetcher) -> Partial:
    return parse_tpex_valuations(f.get_json(f"{TPEX_WEB}/peQryDate", params={"response": "json"}))
