"""證交所（TWSE）與櫃買中心（TPEx）OpenAPI：公司基本資料、每日行情與估值、最新月營收。

這些端點只提供「最新一期」資料，適合每日／每月排程；歷史資料請用 `sources.mops`。
"""

from __future__ import annotations

from datetime import date
from typing import Any

from ..http import Fetcher
from ..industry import industry_name
from ..parse import (
    ad_date,
    bounded,
    is_common_stock,
    normalize_text,
    positive_or_none,
    roc_date,
    roc_year_month,
    thousand_to_yuan,
    to_float,
    to_int,
)

TWSE = "https://openapi.twse.com.tw/v1"
TPEX = "https://www.tpex.org.tw/openapi/v1"


def _s(value: Any) -> str | None:
    if value is None:
        return None
    text = normalize_text(str(value))
    return text or None


def _note(value: Any) -> str | None:
    text = _s(value)
    return None if text in (None, "-", "－", "無", "無。") else text


# ── 公司基本資料 ─────────────────────────────────────────


def map_twse_company(r: dict[str, Any]) -> dict[str, Any] | None:
    code = _s(r.get("公司代號"))
    if not is_common_stock(code):
        return None
    return {
        "code": code,
        "name": _s(r.get("公司簡稱")) or _s(r.get("公司名稱")) or code,
        "full_name": _s(r.get("公司名稱")),
        "market": "twse",
        "industry": industry_name(r.get("產業別")),
        "capital": to_int(r.get("實收資本額")),
        "shares_outstanding": to_int(r.get("已發行普通股數或TDR原股發行股數")),
        "listed_at": ad_date(r.get("上市日期")),
        "is_active": True,
    }


def map_tpex_company(r: dict[str, Any]) -> dict[str, Any] | None:
    code = _s(r.get("SecuritiesCompanyCode"))
    if not is_common_stock(code):
        return None
    return {
        "code": code,
        "name": _s(r.get("CompanyAbbreviation")) or _s(r.get("CompanyName")) or code,
        "full_name": _s(r.get("CompanyName")),
        "market": "tpex",
        "industry": industry_name(r.get("SecuritiesIndustryCode")),
        "capital": to_int(r.get("Paidin.Capital.NTDollars")),
        "shares_outstanding": to_int(r.get("IssueShares")),
        "listed_at": ad_date(r.get("DateOfListing")),
        "is_active": True,
    }


def fetch_companies(f: Fetcher) -> list[dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in f.get_json(f"{TPEX}/mopsfin_t187ap03_O"):
        if row := map_tpex_company(r):
            out[row["code"]] = row
    for r in f.get_json(f"{TWSE}/opendata/t187ap03_L"):  # 同代號以上市為準
        if row := map_twse_company(r):
            out[row["code"]] = row
    return list(out.values())


# ── 每日行情與估值 ───────────────────────────────────────


def _merge(target: dict[tuple[str, date], dict[str, Any]], code: str | None, day: date | None, values: dict) -> None:
    if not is_common_stock(code) or day is None:
        return
    values = {k: v for k, v in values.items() if v is not None}
    if not values:
        return
    row = target.setdefault((code, day), {"code": code, "trade_date": day})  # type: ignore[arg-type]
    row.update(values)


def map_daily(
    twse_quotes: list[dict], twse_valuations: list[dict], tpex_quotes: list[dict], tpex_valuations: list[dict]
) -> list[dict[str, Any]]:
    rows: dict[tuple[str, date], dict[str, Any]] = {}
    for r in twse_quotes:
        _merge(
            rows,
            _s(r.get("Code")),
            roc_date(r.get("Date")),
            {
                "close": positive_or_none(r.get("ClosingPrice")),
                "change": to_float(r.get("Change")),
                "volume": to_int(r.get("TradeVolume")),
                "trade_value": to_int(r.get("TradeValue")),
            },
        )
    for r in tpex_quotes:
        _merge(
            rows,
            _s(r.get("SecuritiesCompanyCode")),
            roc_date(r.get("Date")),
            {
                "close": positive_or_none(r.get("Close")),
                "change": to_float(r.get("Change")),
                "volume": to_int(r.get("TradingShares")),
                "trade_value": to_int(r.get("TransactionAmount")),
            },
        )
    for r in twse_valuations:
        _merge(
            rows,
            _s(r.get("Code")),
            roc_date(r.get("Date")),
            {
                "pe": positive_or_none(r.get("PEratio")),
                "pb": positive_or_none(r.get("PBratio")),
                "dividend_yield": to_float(r.get("DividendYield")),
            },
        )
    for r in tpex_valuations:
        _merge(
            rows,
            _s(r.get("SecuritiesCompanyCode")),
            roc_date(r.get("Date")),
            {
                "pe": positive_or_none(r.get("PriceEarningRatio")),
                "pb": positive_or_none(r.get("PriceBookRatio")),
                "dividend_yield": to_float(r.get("YieldRatio")),
            },
        )
    return list(rows.values())


def fetch_daily(f: Fetcher) -> list[dict[str, Any]]:
    return map_daily(
        f.get_json(f"{TWSE}/exchangeReport/STOCK_DAY_ALL"),
        f.get_json(f"{TWSE}/exchangeReport/BWIBBU_ALL"),
        f.get_json(f"{TPEX}/tpex_mainboard_daily_close_quotes"),
        f.get_json(f"{TPEX}/tpex_mainboard_peratio_analysis"),
    )


# ── 月營收 ───────────────────────────────────────────────


def map_revenue(r: dict[str, Any]) -> dict[str, Any] | None:
    code = _s(r.get("公司代號"))
    ym = roc_year_month(r.get("資料年月"))
    if not is_common_stock(code) or ym is None:
        return None
    return {
        "code": code,
        "year": ym[0],
        "month": ym[1],
        "revenue": thousand_to_yuan(r.get("營業收入-當月營收")),
        "revenue_last_year": thousand_to_yuan(r.get("營業收入-去年當月營收")),
        "mom": bounded(to_float(r.get("營業收入-上月比較增減(%)"))),
        "yoy": bounded(to_float(r.get("營業收入-去年同月增減(%)"))),
        "cum_revenue": thousand_to_yuan(r.get("累計營業收入-當月累計營收")),
        "cum_yoy": bounded(to_float(r.get("累計營業收入-前期比較增減(%)"))),
        "note": _note(r.get("備註")),
    }


def fetch_monthly_revenue(f: Fetcher) -> list[dict[str, Any]]:
    rows = f.get_json(f"{TWSE}/opendata/t187ap05_L") + f.get_json(f"{TPEX}/mopsfin_t187ap05_O")
    return [row for r in rows if (row := map_revenue(r))]


# ── 營益分析（用來交叉驗證我們自己算的毛利率等指標）────────────


def fetch_official_margins(f: Fetcher) -> dict[str, dict[str, Any]]:
    """官方「營益分析」：最新一季的累計毛利率、營益率、稅後純益率。key 為股票代號。"""
    out: dict[str, dict[str, Any]] = {}
    for r in f.get_json(f"{TWSE}/opendata/t187ap17_L"):
        code = _s(r.get("公司代號"))
        if is_common_stock(code):
            out[code] = {  # type: ignore[index]
                "year": to_int(r.get("年度")),
                "quarter": to_int(r.get("季別")),
                "gross_margin": to_float(r.get("毛利率(%)(營業毛利)/(營業收入)")),
                "operating_margin": to_float(r.get("營業利益率(%)(營業利益)/(營業收入)")),
                "net_margin": to_float(r.get("稅後純益率(%)(稅後純益)/(營業收入)")),
            }
    for r in f.get_json(f"{TPEX}/mopsfin_187ap17_O"):
        code = _s(r.get("SecuritiesCompanyCode"))
        if is_common_stock(code):
            out[code] = {  # type: ignore[index]
                "year": to_int(r.get("Year")),
                "quarter": to_int(r.get("季別")),
                "gross_margin": to_float(r.get("毛利率")),
                "operating_margin": to_float(r.get("營業利益率")),
                "net_margin": to_float(r.get("稅後純益率")),
            }
    return out
