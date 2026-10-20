from datetime import date

from tw_etl.html_tables import parse_rows
from tw_etl.sources.mops import detect_report_type, parse_dividend_html, parse_revenue_html, parse_statement_html


def test_parse_rows_tolerates_missing_end_tags_and_nested_tables():
    html = """
    <table><tr><th>公司代號<th>公司名稱<th>營業收入
    <tr><td>2330<td>台積電<td>1,000
    <tr><td>2303<td>聯電<td>500</table>
    <table><tr><td>外層<table><tr><td>內層</td></tr></table></td></tr></table>
    """
    rows = parse_rows(html)
    assert ["公司代號", "公司名稱", "營業收入"] in rows
    assert ["2330", "台積電", "1,000"] in rows
    assert ["2303", "聯電", "500"] in rows
    assert ["內層"] in rows
    assert ["外層"] in rows


def test_detect_report_type():
    assert detect_report_type({"營業收入", "營業成本"}) == "ci"
    assert detect_report_type({"利息淨收益", "利息以外淨收益"}) == "fh"
    assert detect_report_type({"利息淨收益", "利息以外淨損益"}) == "basi"
    assert detect_report_type({"收益", "支出及費用"}) == "bd"
    assert detect_report_type({"保險服務結果"}) == "ins"
    assert detect_report_type({"收入", "支出"}) == "mim"
    assert detect_report_type({"流動資產"}) is None


STATEMENT_HTML = """
<table class="hasBorder">
<tr><th>公司代號</th><th>公司名稱</th><th>利息淨收益</th><th>利息以外淨收益</th><th>淨收益</th></tr>
<tr><td>2881</td><td>富邦金</td><td>190,389,088</td><td>190,917,047</td><td>381,306,135</td></tr>
</table>
<table class="hasBorder">
<tr><th>公司代號</th><th>公司名稱</th><th>營業收入</th><th>營業成本</th><th>基本每股盈餘（元）</th></tr>
<tr><td>2330</td><td>台積電</td><td>2,404,483,690</td><td>792,877,574</td><td>49.33</td></tr>
<tr><td>合計</td><td></td><td>1</td><td>1</td><td>1</td></tr>
</table>
"""


def test_parse_statement_html_assigns_report_type_per_table():
    rows = {r.code: r for r in parse_statement_html(STATEMENT_HTML)}
    assert set(rows) == {"2881", "2330"}
    assert rows["2881"].report_type == "fh"
    assert rows["2330"].report_type == "ci"
    assert rows["2330"].values["基本每股盈餘（元）"] == "49.33"


REVENUE_HTML = """
<table><tr><th>產業別：半導體業</th></tr>
<tr><td>
  <table>
  <tr><th>公司代號</th><th>公司名稱</th><th>當月營收</th><th>上月營收</th><th>去年當月營收</th>
      <th>上月比較增減(%)</th><th>去年同月增減(%)</th><th>當月累計營收</th><th>去年累計營收</th>
      <th>前期比較增減(%)</th><th>備註</th></tr>
  <tr><td>2330</td><td>台積電</td><td>330,980,920</td><td>335,772,129</td><td>251,872,717</td>
      <td>-1.42</td><td>31.40</td><td>2,762,963,851</td><td>2,025,846,521</td><td>36.38</td><td>-</td></tr>
  <tr><td>合計</td><td></td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td></td></tr>
  </table>
</td></tr></table>
"""


def test_parse_revenue_html_converts_thousands():
    rows = parse_revenue_html(REVENUE_HTML, 2025, 9)
    assert rows == [
        {
            "code": "2330",
            "year": 2025,
            "month": 9,
            "revenue": 330_980_920_000,
            "revenue_last_year": 251_872_717_000,
            "mom": -1.42,
            "yoy": 31.4,
            "cum_revenue": 2_762_963_851_000,
            "cum_yoy": 36.38,
            "note": None,
        }
    ]


def _dividend_row(code, progress, period, board, cash, stock_capital="0.0"):
    cells = [
        f"{code} - 測試",
        progress,
        period,
        "",
        "1",
        board,
        "",
        "0",
        "0",
        "0",
        "0",
        cash,
        "0.0",
        "0.0",
        "0",
        "0.0",
        "0.0",
        stock_capital,
        "0",
        "",
        "",
    ]
    return "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"


def test_parse_dividend_html_old_six_column_layout():
    """2018 年以前的格式：公積發放的現金與配股各合併成一欄，股東配發內容只有 6 欄。"""
    sub_header = (
        "<tr><td>盈餘分配 之現金股利 (元/股)</td><td>法定盈餘 公積、資本 公積發放 之現金(元/股)</td>"
        "<td>股東配發 之現金(股利) 總金額(元)</td><td>盈餘轉 增資配股 (元/股)</td>"
        "<td>法定盈餘 公積、資本 公積轉增資 配股(元/股)</td><td>股東配股 總股數(股)</td></tr>"
    )
    cells = ["1101 - 台泥", "股東會確認", "105年 年度", "105/01/01~105/12/31", "1", "0", "106/06/28"]
    cells += ["0", "0", "0", "0", "1.45000000", "0.0", "5,353,655,010", "0.2", "0.0", "0", "", ""]
    data = "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
    (row,) = parse_dividend_html(f"<table>{sub_header}{data}</table>")
    assert row["code"] == "1101"
    assert (row["fiscal_year"], row["period"]) == (2016, "FY")
    assert row["cash_dividend"] == 1.45  # 不能把「現金總額 5,353,655,010 元」算進去
    assert row["stock_dividend"] == 0.2
    assert row["board_date"] is None  # 原始資料為 "0"


def test_parse_dividend_html_prefers_shareholder_confirmation():
    html = (
        "<table>"
        + _dividend_row("2881", "董事會決議", "112年年度", "113/03/10", "2.00000000")
        + _dividend_row("2881", "股東會確認", "112年年度", "113/04/25", "2.50000000", "0.50000000")
        + _dividend_row("2881A", "股東會確認", "112年年度", "113/04/25", "2.66")  # 特別股略過
        + _dividend_row("2330", "董事會決議", "113年第3季", "113/11/12", "4.50002042")
        + "</table>"
    )
    rows = {(r["code"], r["fiscal_year"], r["period"]): r for r in parse_dividend_html(html)}
    assert set(rows) == {("2881", 2023, "FY"), ("2330", 2024, "Q3")}
    assert rows[("2881", 2023, "FY")]["cash_dividend"] == 2.5
    assert rows[("2881", 2023, "FY")]["stock_dividend"] == 0.5
    assert rows[("2881", 2023, "FY")]["board_date"] == date(2024, 4, 25)
    assert rows[("2330", 2024, "Q3")]["cash_dividend"] == 4.5
