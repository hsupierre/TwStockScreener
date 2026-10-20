from datetime import date

import pytest

from tw_etl.parse import (
    ad_date,
    bounded,
    dividend_period,
    is_common_stock,
    positive_or_none,
    roc_date,
    roc_year_month,
    thousand_to_yuan,
    to_float,
    to_int,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1,234.50", 1234.5),
        (" -38.00 ", -38.0),
        ("+5.0", 5.0),
        ("0.0000", 0.0),
        ("--", None),
        ("", None),
        ("N/A", None),
        ("不適用", None),
        ("除息", None),
        ("abc", None),
        (None, None),
        (12, 12.0),
        (float("nan"), None),
    ],
)
def test_to_float(raw, expected):
    assert to_float(raw) == expected


def test_to_int_and_thousand_to_yuan():
    assert to_int("25932370067") == 25932370067
    assert thousand_to_yuan("2,404,483,690") == 2_404_483_690_000
    assert thousand_to_yuan("2404483690.00") == 2_404_483_690_000
    assert thousand_to_yuan("--") is None


def test_positive_or_none():
    assert positive_or_none("28.05") == 28.05
    assert positive_or_none("0.00") is None
    assert positive_or_none("-3") is None


def test_bounded():
    assert bounded(12.3456) == 12.35
    assert bounded(1e9) is None
    assert bounded(None) is None
    assert bounded(float("inf")) is None


def test_roc_dates():
    assert roc_date("1151019") == date(2026, 10, 19)
    assert roc_date("115/10/19") == date(2026, 10, 19)
    assert roc_date("113年01月04日") == date(2024, 1, 4)
    assert roc_date("991231") == date(2010, 12, 31)
    assert roc_date("不適用") is None
    assert roc_date("1151399") is None
    assert ad_date("19940905") == date(1994, 9, 5)
    assert ad_date("") is None


def test_roc_year_month():
    assert roc_year_month("11509") == (2026, 9)
    assert roc_year_month("11513") is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("113年年度", (2024, "FY")),
        ("113年第3季", (2024, "Q3")),
        ("113年 第 1 季", (2024, "Q1")),
        ("113年上半年", (2024, "H1")),
        ("113年下半年", (2024, "H2")),
        ("其他", None),
    ],
)
def test_dividend_period(raw, expected):
    assert dividend_period(raw) == expected


def test_is_common_stock():
    assert is_common_stock("2330")
    assert not is_common_stock("2881A")
    assert not is_common_stock("00878")
    assert not is_common_stock("")
    assert not is_common_stock(None)
