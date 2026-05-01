"""FR-007 — refuse path traversal, separators and other unsafe card ids."""
from __future__ import annotations

import pytest

from download_cards import is_safe_card_id


@pytest.mark.parametrize(
    "card_id",
    [
        "sv3pt5-25",
        "sv3pt5-001",
        "sv-25",
        "abc123",
        "a-b-c",
    ],
)
def test_safe_ids_accepted(card_id: str) -> None:
    assert is_safe_card_id(card_id)


@pytest.mark.parametrize(
    "card_id",
    [
        "../etc/passwd",
        "..",
        "foo/bar",
        "foo\\bar",
        "foo bar",
        "/abs",
        ".hidden",
        "",
        "card$id",
        "name with spaces",
    ],
)
def test_unsafe_ids_rejected(card_id: str) -> None:
    assert not is_safe_card_id(card_id)
