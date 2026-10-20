"""季報：欄位對應（不同產業格式欄位名稱不同）與「年度累計值 → 單季值」轉換。"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from ..parse import normalize_header, thousand_to_yuan, to_float
from ..sources.mops import StatementRow

# 每個欄位依序嘗試的候選欄位名稱（MOPS 與 OpenAPI 的寫法略有不同，金融業格式也不同）
INCOME_FIELDS: dict[str, list[str]] = {
    "revenue": ["營業收入", "淨收益", "收益", "收入", "營業收入合計"],
    "gross_profit": ["營業毛利（毛損）淨額", "營業毛利（毛損）"],
    "operating_income": ["營業利益（損失）"],
    "pretax_income": [
        "稅前淨利（淨損）",
        "繼續營業單位稅前淨利（淨損）",
        "繼續營業單位稅前損益",
        "繼續營業單位稅前純益（純損）",
    ],
    "net_income": ["本期淨利（淨損）", "本期稅後淨利（淨損）"],
    "net_income_parent": ["淨利（淨損）歸屬於母公司業主", "淨利（損）歸屬於母公司業主"],
}
BALANCE_FIELDS: dict[str, list[str]] = {
    "total_assets": ["資產總計", "資產總額"],
    "total_liabilities": ["負債總計", "負債總額"],
    "equity": ["權益總計", "權益總額"],
    "equity_parent": ["歸屬於母公司業主之權益合計", "歸屬於母公司業主權益合計", "歸屬於母公司業主之權益"],
    "current_assets": ["流動資產"],
    "current_liabilities": ["流動負債"],
}
CASHFLOW_FIELDS: dict[str, list[str]] = {
    "operating_cash_flow": ["營業活動之淨現金流入（流出）"],
}

# 年度累計、需要相減成單季的欄位
FLOW_FIELDS = [*INCOME_FIELDS, "eps", *CASHFLOW_FIELDS]
STOCK_FIELDS = [*BALANCE_FIELDS, "book_value_per_share"]

_INCOME_C = {k: [normalize_header(c) for c in v] for k, v in INCOME_FIELDS.items()}
_BALANCE_C = {k: [normalize_header(c) for c in v] for k, v in BALANCE_FIELDS.items()}
_CASHFLOW_C = {k: [normalize_header(c) for c in v] for k, v in CASHFLOW_FIELDS.items()}


def _pick_yuan(values: dict[str, str], candidates: list[str]) -> int | None:
    for c in candidates:
        if c in values and (v := thousand_to_yuan(values[c])) is not None:
            return v
    return None


def map_income(values: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {k: _pick_yuan(values, c) for k, c in _INCOME_C.items()}
    if out["revenue"] is None:  # 銀行業沒有「淨收益」欄位：利息淨收益 + 利息以外淨損益
        interest = thousand_to_yuan(values.get("利息淨收益"))
        other = thousand_to_yuan(values.get("利息以外淨損益") or values.get("利息以外淨收益"))
        if interest is not None and other is not None:
            out["revenue"] = interest + other
    out["eps"] = to_float(values.get("基本每股盈餘（元）"))
    return out


def map_balance(values: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {k: _pick_yuan(values, c) for k, c in _BALANCE_C.items()}
    out["book_value_per_share"] = to_float(values.get("每股參考淨值"))
    return out


def map_cashflow(values: dict[str, str]) -> dict[str, Any]:
    return {k: _pick_yuan(values, c) for k, c in _CASHFLOW_C.items()}


Key = tuple[str, int, int]  # (code, year, quarter)


def merge_statements(
    year: int,
    quarter: int,
    income: Iterable[StatementRow],
    balance: Iterable[StatementRow],
    cashflow: Iterable[StatementRow],
) -> dict[Key, dict[str, Any]]:
    """把同一季的三張報表合併成每家公司一筆（流量欄位仍是年度累計值）。"""
    out: dict[Key, dict[str, Any]] = {}

    def row(code: str) -> dict[str, Any]:
        return out.setdefault((code, year, quarter), {"report_type": None})

    for r in income:
        rec = row(r.code)
        rec["report_type"] = r.report_type
        rec.update(map_income(r.values))
    for r in balance:
        row(r.code).update(map_balance(r.values))
    for r in cashflow:
        row(r.code).update(map_cashflow(r.values))
    return out


def to_single_quarter(cumulative: dict[Key, dict[str, Any]]) -> list[dict[str, Any]]:
    """Q1 單季 = Q1 累計；Qn 單季 = Qn 累計 − Q(n−1) 累計。缺少前一季累計值時，單季流量為 None。"""
    rows: list[dict[str, Any]] = []
    for (code, year, quarter), cum in sorted(cumulative.items()):
        prev = cumulative.get((code, year, quarter - 1)) if quarter > 1 else None
        out: dict[str, Any] = {"code": code, "year": year, "quarter": quarter, "report_type": cum.get("report_type")}
        for f in FLOW_FIELDS:
            value = cum.get(f)
            if quarter > 1:
                prev_value = prev.get(f) if prev else None
                value = None if value is None or prev_value is None else value - prev_value
            if f == "eps" and value is not None:
                value = round(value, 2)
            out[f] = value
        for f in STOCK_FIELDS:
            out[f] = cum.get(f)
        rows.append(out)
    return rows
