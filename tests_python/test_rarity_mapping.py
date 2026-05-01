"""FR-003 — full coverage of the rarity-to-bucket mapping table."""
from __future__ import annotations

import pytest
from download_cards import bucket_for


@pytest.mark.parametrize(
    "rarity_raw, bucket",
    [
        ("Common", "01_comum"),
        ("Uncommon", "02_incomum"),
        ("Rare", "03_raras"),
        ("Rare Holo", "03_raras"),
        ("Double Rare", "04_duplo_raras"),
        ("Rare Ultra", "04_duplo_raras"),
        ("Ultra Rare", "04_duplo_raras"),
        ("Rare Holo EX", "04_duplo_raras"),
        ("Rare Holo GX", "04_duplo_raras"),
        ("Rare Holo V", "04_duplo_raras"),
        ("Rare Holo VMAX", "04_duplo_raras"),
        ("Illustration Rare", "05_arte_secreta"),
        ("Special Illustration Rare", "06_duplo_arte_secreta"),
        ("Rare Rainbow", "06_duplo_arte_secreta"),
        ("Rare Secret", "06_duplo_arte_secreta"),
        ("Hyper Rare", "07_legendaria"),
    ],
)
def test_known_rarity_maps_to_expected_bucket(rarity_raw: str, bucket: str) -> None:
    assert bucket_for(rarity_raw) == bucket


def test_mapping_is_case_insensitive() -> None:
    assert bucket_for("COMMON") == "01_comum"
    assert bucket_for("rare holo") == "03_raras"
    assert bucket_for("Hyper RARE") == "07_legendaria"


def test_unknown_rarity_returns_none() -> None:
    assert bucket_for("Promo") is None
    assert bucket_for("ACE SPEC Rare") is None
    assert bucket_for("") is None
    assert bucket_for(None) is None


def test_all_seven_buckets_have_at_least_one_source_rarity() -> None:
    from download_cards import BUCKETS, RARITY_TO_BUCKET

    covered = set(RARITY_TO_BUCKET.values())
    for b in BUCKETS:
        assert b in covered, f"bucket {b} has no source rarity in the mapping"
