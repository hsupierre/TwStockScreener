"""公開資訊觀測站（MOPS 舊站 mopsov）：季報彙總表、月營收歷史、股利分派彙總。

- 季報彙總表：一次請求取得「單一市場、單一季」全部公司的累計值（千元）。
- 月營收：靜態 HTML，每市場每月一個檔案（Big5）。
- 股利分派：依「董事會決議年度」查詢全市場（Big5）。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal

from ..html_tables import parse_rows
from ..http import Fetcher, FetchError
from ..parse import (
    bounded,
    dividend_period,
    is_common_stock,
    normalize_header,
    roc_date,
    thousand_to_yuan,
    to_float,
)

log = logging.getLogger(__name__)

MOPS = "https://mopsov.twse.com.tw"
TYPEK = {"twse": "sii", "tpex": "otc"}
Market = Literal["twse", "tpex"]
Report = Literal["income", "balance", "cashflow"]
REPORT_PAGES: dict[str, str] = {
    "income": "ajax_t163sb04",  # 綜合損益表彙總
    "balance": "ajax_t163sb05",  # 資產負債表彙總
    "cashflow": "ajax_t163sb20",  # 現金流量表彙總
}
NO_DATA_MARKERS = ("查詢無資料", "查無所需資料", "查無資料", "無應編製合併財報")


@dataclass(frozen=True)
class StatementRow:
    code: str
    report_type: str | None
    values: dict[str, str]  # 正規化後的欄位名稱 → 原始字串


def detect_report_type(headers: set[str]) -> str | None:
    """依綜合損益表的欄位組合判斷財報格式。"""
    if headers & {"保險服務結果", "保險服務收入", "簽單保費收入"}:
        return "ins"
    if "利息淨收益" in headers and "利息以外淨收益" in headers:
        return "fh"
    if "利息淨收益" in headers and "利息以外淨損益" in headers:
        return "basi"
    if "收益" in headers and "支出及費用" in headers:
        return "bd"
    if "營業收入" in headers and "營業成本" in headers:
        return "ci"
    if "收入" in headers and "支出" in headers:
        return "mim"
    return None


def parse_statement_html(html: str) -> list[StatementRow]:
    out: list[StatementRow] = []
    header: list[str] | None = None
    report_type: str | None = None
    for row in parse_rows(html):
        if not row:
            continue
        first = normalize_header(row[0])
        if first == "公司代號":
            header = [normalize_header(c) for c in row]
            report_type = detect_report_type(set(header))
            continue
        if header is None or not is_common_stock(first):
            continue
        values = {h: v for h, v in zip(header, row, strict=False) if h}
        out.append(StatementRow(code=first, report_type=report_type, values=values))
    return out


def fetch_statement(f: Fetcher, report: Report, market: Market, year: int, quarter: int) -> list[StatementRow]:
    html = f.post_form(
        f"{MOPS}/mops/web/{REPORT_PAGES[report]}",
        {
            "encodeURIComponent": 1,
            "step": 1,
            "firstin": 1,
            "off": 1,
            "isQuery": "Y",
            "TYPEK": TYPEK[market],
            "year": year - 1911,
            "season": f"{quarter:02d}",
        },
        encoding="utf-8",
    )
    rows = parse_statement_html(html)
    if not rows and not any(m in html for m in NO_DATA_MARKERS):
        raise FetchError(f"MOPS {report} {market} {year}Q{quarter} 回應無法解析：{html[:200]!r}")
    log.info("MOPS %s %s %dQ%d：%d 家", report, market, year, quarter, len(rows))
    return rows


# ── 月營收（歷史）────────────────────────────────────────

_INDUSTRY_RE = re.compile(r"產業別[:：]\s*(\S+)")


def parse_revenue_html(html: str, year: int, month: int) -> list[dict]:
    """t21sc03 靜態檔：公司代號、名稱、當月、上月、去年當月、月增%、年增%、當月累計、去年累計、累計年增%、備註。"""
    out: list[dict] = []
    for row in parse_rows(html):
        if len(row) < 10 or not is_common_stock(row[0]):
            continue
        note = row[10].strip() if len(row) > 10 else ""
        out.append(
            {
                "code": row[0].strip(),
                "year": year,
                "month": month,
                "revenue": thousand_to_yuan(row[2]),
                "revenue_last_year": thousand_to_yuan(row[4]),
                "mom": bounded(to_float(row[5])),
                "yoy": bounded(to_float(row[6])),
                "cum_revenue": thousand_to_yuan(row[7]),
                "cum_yoy": bounded(to_float(row[9])),
                "note": None if note in ("", "-", "－", "無") else note,
            }
        )
    return out


def fetch_revenue_month(f: Fetcher, market: Market, year: int, month: int) -> list[dict]:
    rows: list[dict] = []
    for suffix in (0, 1):  # 0：本國公司，1：外國公司（KY）
        url = f"{MOPS}/nas/t21/{TYPEK[market]}/t21sc03_{year - 1911}_{month}_{suffix}.html"
        try:
            html = f.get_text(url, encoding="cp950")
        except FetchError as e:
            if suffix == 1:  # 外國公司檔案不一定存在
                log.debug("略過 %s：%s", url, e)
                continue
            raise
        rows.extend(parse_revenue_html(html, year, month))
    log.info("MOPS 月營收 %s %d-%02d：%d 家", market, year, month, len(rows))
    return rows


# ── 股利分派 ─────────────────────────────────────────────

_DIVIDEND_CODE_RE = re.compile(r"^(\d{4})\s*-")


def _sum(cells: list[str]) -> float:
    return sum(v for c in cells if (v := to_float(c)) is not None)


DIVIDEND_DETAIL_START = 11  # 資料列中「股東配發內容」從第 12 欄開始
MAX_PER_SHARE = 1000.0  # 每股股利超過這個值一定是欄位錯位


def _dividend_columns(sub_header: list[str]) -> tuple[list[int], list[int]]:
    """依「股東配發內容」子表頭找出每股現金與每股配股欄位。

    新版 8 欄：盈餘現金、法定公積現金、資本公積現金、現金總額、盈餘配股、法定公積配股、資本公積配股、配股總股數
    舊版 6 欄：盈餘現金、公積現金、現金總額、盈餘配股、公積配股、配股總股數
    """
    labels = [normalize_header(c) for c in sub_header]
    cash = [i for i, h in enumerate(labels) if "現金" in h and "元/股" in h]
    stock = [i for i, h in enumerate(labels) if "配股" in h and "元/股" in h]
    return [DIVIDEND_DETAIL_START + i for i in cash], [DIVIDEND_DETAIL_START + i for i in stock]


def parse_dividend_html(html: str) -> list[dict]:
    """t05st09sub：同一期間可能有董事會決議與股東會確認兩筆，以股東會確認、最新決議日為準。"""
    best: dict[tuple[str, int, str], tuple[tuple[bool, str], dict]] = {}
    cash_cols, stock_cols = [11, 12, 13], [15, 16, 17]  # 預設新版格式
    for row in parse_rows(html):
        if row and normalize_header(row[0]).startswith("盈餘分配之現金股利"):
            cash_cols, stock_cols = _dividend_columns(row)
            continue
        if len(row) <= max(cash_cols + stock_cols):
            continue
        m = _DIVIDEND_CODE_RE.match(row[0])
        period = dividend_period(row[2])
        if not m or period is None:
            continue
        board_date = roc_date(row[5])
        record = {
            "code": m.group(1),
            "fiscal_year": period[0],
            "period": period[1],
            "cash_dividend": round(_sum([row[i] for i in cash_cols]), 4),
            "stock_dividend": round(_sum([row[i] for i in stock_cols]), 4),
            "board_date": board_date,
        }
        if record["cash_dividend"] >= MAX_PER_SHARE or record["stock_dividend"] >= MAX_PER_SHARE:
            log.warning("略過不合理的股利資料（欄位可能錯位）：%s", record)
            continue
        rank = ("股東會" in row[1], board_date.isoformat() if board_date else "")
        key = (record["code"], record["fiscal_year"], record["period"])
        if key not in best or rank >= best[key][0]:
            best[key] = (rank, record)
    return [rec for _, rec in best.values()]


def fetch_dividends(f: Fetcher, market: Market, board_year: int) -> list[dict]:
    html = f.post_form(
        f"{MOPS}/server-java/t05st09sub",
        {"step": 1, "TYPEK": TYPEK[market], "YEAR": board_year - 1911, "qryType": 1},
        encoding="cp950",
    )
    rows = parse_dividend_html(html)
    log.info("MOPS 股利 %s 決議年度 %d：%d 筆", market, board_year, len(rows))
    return rows
