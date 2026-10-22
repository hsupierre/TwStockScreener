from datetime import date

from tw_etl.jobs import available_quarters, representative_quarter


def test_representative_quarter_ignores_early_filers():
    counts = {(2026, 1): 1980, (2026, 2): 1981, (2026, 3): 5}
    assert representative_quarter(counts) == (2026, 2)


def test_representative_quarter_accepts_quarter_once_most_have_filed():
    assert representative_quarter({(2026, 2): 1981, (2026, 3): 1200}) == (2026, 3)
    assert representative_quarter({}) is None
    assert representative_quarter({(2026, 3): 0}) is None


def test_available_quarters_only_includes_finished_quarters():
    assert available_quarters(date(2026, 10, 23), [2026]) == [(2026, 1), (2026, 2), (2026, 3)]
    assert available_quarters(date(2026, 1, 5), [2025, 2026]) == [(2025, 1), (2025, 2), (2025, 3), (2025, 4)]
