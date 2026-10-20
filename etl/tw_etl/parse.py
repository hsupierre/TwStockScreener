"""官方資料的數值與民國日期解析。所有函式遇到無法解析的值都回傳 None，不丟例外。"""

from __future__ import annotations

import math
import re
from datetime import date

ROC_OFFSET = 1911
MISSING = {"", "-", "--", "---", "－", "N/A", "NA", "n/a", "不適用", "None", "null", "除權息", "除息", "除權"}

_NUM_RE = re.compile(r"^[+-]?\d+(\.\d+)?$")


def to_float(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, int | float):
        return float(value) if math.isfinite(value) else None
    s = str(value).strip().replace(",", "").replace(" ", "")
    if s in MISSING:
        return None
    if s.startswith("+"):
        s = s[1:]
    if not _NUM_RE.match(s):
        return None
    return float(s)


def to_int(value: object) -> int | None:
    f = to_float(value)
    return None if f is None else round(f)


def thousand_to_yuan(value: object) -> int | None:
    """官方財報與營收多以「千元」為單位，統一換算成元。"""
    f = to_float(value)
    return None if f is None else round(f * 1000)


def positive_or_none(value: object) -> float | None:
    """本益比、淨值比等指標為 0 或負數時代表不適用（例如虧損）。"""
    f = to_float(value)
    return f if f is not None and f > 0 else None


def bounded(value: float | None, digits: int = 2, max_abs: float = 1e8) -> float | None:
    """四捨五入並排除會超過資料庫 numeric 欄位範圍的極端值（例如基期接近 0 的成長率）。"""
    if value is None or not math.isfinite(value) or abs(value) >= max_abs:
        return None
    return round(value, digits)


def roc_year(value: object) -> int | None:
    n = to_int(value)
    return None if n is None or n <= 0 else n + ROC_OFFSET


def roc_date(value: object) -> date | None:
    """支援 1151019、115/10/19、115年10月19日。"""
    if value is None:
        return None
    s = str(value).strip()
    m = re.fullmatch(r"(\d{2,3})(\d{2})(\d{2})", s) or re.fullmatch(r"(\d{2,3})[/\-年](\d{1,2})[/\-月](\d{1,2})日?", s)
    if not m:
        return None
    try:
        return date(int(m.group(1)) + ROC_OFFSET, int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def ad_date(value: object) -> date | None:
    """西元 8 碼日期，例如 19940905。"""
    s = str(value or "").strip()
    if not re.fullmatch(r"\d{8}", s):
        return None
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:]))
    except ValueError:
        return None


def roc_year_month(value: object) -> tuple[int, int] | None:
    """11509 → (2026, 9)。"""
    s = str(value or "").strip()
    m = re.fullmatch(r"(\d{2,3})(\d{2})", s)
    if not m:
        return None
    year, month = int(m.group(1)) + ROC_OFFSET, int(m.group(2))
    return (year, month) if 1 <= month <= 12 else None


_PERIOD_RE = re.compile(r"(\d{2,3})\s*年\s*(年度|上半年|下半年|第\s*([1-4])\s*季)")


def dividend_period(value: object) -> tuple[int, str] | None:
    """股利所屬期間：「113年年度」→ (2024, 'FY')、「113年第3季」→ (2024, 'Q3')、「113年上半年」→ (2024, 'H1')。"""
    m = _PERIOD_RE.search(str(value or ""))
    if not m:
        return None
    year = int(m.group(1)) + ROC_OFFSET
    kind = m.group(2)
    if kind == "年度":
        return year, "FY"
    if kind == "上半年":
        return year, "H1"
    if kind == "下半年":
        return year, "H2"
    return year, f"Q{m.group(3)}"


def normalize_text(value: str) -> str:
    """合併空白（含全形空白、tab、換行），去除前後空白。"""
    return re.sub(r"[\s　\xa0]+", " ", value).strip()


def normalize_header(value: str) -> str:
    """欄位名稱比對用：移除所有空白。"""
    return re.sub(r"[\s　\xa0]+", "", value)


STOCK_CODE_RE = re.compile(r"^\d{4}$")


def is_common_stock(code: str | None) -> bool:
    """一般股票為 4 碼數字；排除特別股（2881A）、權證、ETF 受益憑證（6 碼）等。"""
    return bool(code) and bool(STOCK_CODE_RE.match(code.strip()))  # type: ignore[union-attr]
