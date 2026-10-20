"""容錯的 HTML 表格解析器。

MOPS 的 HTML 常缺少 </th>、</tr> 等結束標籤，也有巢狀表格。這裡依文件順序輸出每一列的儲存格文字，
遇到新的 <td>/<th> 或 <tr> 時自動結束上一個儲存格或列。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser

from .parse import normalize_text


@dataclass
class _TableState:
    row: list[str] | None = None
    cell: list[str] | None = None
    rows: list[list[str]] = field(default_factory=list)


class _RowParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._stack: list[_TableState] = []

    def _close_cell(self, t: _TableState) -> None:
        if t.cell is not None and t.row is not None:
            t.row.append(normalize_text("".join(t.cell)))
        t.cell = None

    def _close_row(self, t: _TableState) -> None:
        self._close_cell(t)
        if t.row is not None:
            self.rows.append(t.row)
        t.row = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._stack.append(_TableState())
            return
        if not self._stack:
            return
        t = self._stack[-1]
        if tag == "tr":
            self._close_row(t)
            t.row = []
        elif tag in ("td", "th"):
            if t.row is None:
                t.row = []
            self._close_cell(t)
            t.cell = []
        elif tag == "br" and t.cell is not None:
            t.cell.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if not self._stack:
            return
        t = self._stack[-1]
        if tag in ("td", "th"):
            self._close_cell(t)
        elif tag == "tr":
            self._close_row(t)
        elif tag == "table":
            self._close_row(t)
            self._stack.pop()

    def handle_data(self, data: str) -> None:
        if self._stack and self._stack[-1].cell is not None:
            self._stack[-1].cell.append(data)


def parse_rows(html: str) -> list[list[str]]:
    """回傳文件中所有表格列（依結束順序），每列是儲存格文字的 list。"""
    parser = _RowParser()
    parser.feed(html)
    parser.close()
    for t in reversed(parser._stack):  # 未關閉的表格也要收尾
        parser._close_row(t)
    return parser.rows
