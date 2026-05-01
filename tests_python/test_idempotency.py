"""FR-005 — second run does not re-download images that already exist locally."""
from __future__ import annotations

import io
import json
from pathlib import Path

from PIL import Image

import download_cards
from download_cards import (
    DownloadReport,
    ensure_buckets,
    process_card,
)


def _png_bytes(color: tuple[int, int, int] = (10, 20, 30)) -> bytes:
    img = Image.new("RGB", (4, 4), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _fake_card(card_id: str = "sv3pt5-25", rarity: str = "Common") -> dict:
    return {
        "id": card_id,
        "name": "Pikachu",
        "rarity": rarity,
        "number": "25",
        "images": {"large": "https://example.test/large.png"},
        "set": {"name": "Scarlet & Violet—151"},
    }


def test_second_run_skips_existing_files(tmp_path: Path, monkeypatch) -> None:
    assets = tmp_path / "assets"
    ensure_buckets(assets)

    calls = {"download": 0}

    def fake_download(url: str, retries: int = 3, backoff: float = 1.0) -> bytes:
        calls["download"] += 1
        return _png_bytes()

    monkeypatch.setattr(download_cards, "download_image", fake_download)

    card = _fake_card()
    report1 = DownloadReport()
    process_card(card, assets_dir=assets, retries=1, backoff=0, quality=85, force=False, dry_run=False, report=report1)
    assert calls["download"] == 1
    assert report1.downloaded == ["sv3pt5-25"]

    report2 = DownloadReport()
    process_card(card, assets_dir=assets, retries=1, backoff=0, quality=85, force=False, dry_run=False, report=report2)
    assert calls["download"] == 1, "second run must not call download_image again"
    assert report2.skipped == ["sv3pt5-25"]
    assert report2.downloaded == []


def test_force_flag_re_downloads(tmp_path: Path, monkeypatch) -> None:
    assets = tmp_path / "assets"
    ensure_buckets(assets)

    calls = {"download": 0}

    def fake_download(url: str, retries: int = 3, backoff: float = 1.0) -> bytes:
        calls["download"] += 1
        return _png_bytes()

    monkeypatch.setattr(download_cards, "download_image", fake_download)

    card = _fake_card()
    report1 = DownloadReport()
    process_card(card, assets_dir=assets, retries=1, backoff=0, quality=85, force=False, dry_run=False, report=report1)

    report2 = DownloadReport()
    process_card(card, assets_dir=assets, retries=1, backoff=0, quality=85, force=True, dry_run=False, report=report2)
    assert calls["download"] == 2
    assert report2.downloaded == ["sv3pt5-25"]
