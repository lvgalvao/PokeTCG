"""FR-007a — the generated manifest validates against contracts/manifest.schema.json."""
from __future__ import annotations

import io
import json
from pathlib import Path

from PIL import Image
from jsonschema import Draft202012Validator

import download_cards
from download_cards import DownloadReport, ensure_buckets, process_card, write_manifest


REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "specs/001-pokemon-booster-opener/contracts/manifest.schema.json"


def _png() -> bytes:
    img = Image.new("RGB", (4, 4), (1, 2, 3))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_manifest_validates_against_schema(tmp_path: Path, monkeypatch) -> None:
    assets = tmp_path / "assets"
    ensure_buckets(assets)
    monkeypatch.setattr(download_cards, "download_image", lambda *a, **k: _png())

    cards = [
        {
            "id": "sv3pt5-25",
            "name": "Pikachu",
            "rarity": "Common",
            "number": "25",
            "images": {"large": "https://example.test/a.png"},
            "set": {"name": "Scarlet & Violet—151"},
        },
        {
            "id": "sv3pt5-172",
            "name": "Pikachu",
            "rarity": "Illustration Rare",
            "number": "172",
            "images": {"large": "https://example.test/b.png"},
            "set": {"name": "Scarlet & Violet—151"},
        },
        {
            "id": "sv3pt5-208",
            "name": "MysteryCard",
            "rarity": "Promo",
            "number": "208",
            "images": {"large": "https://example.test/c.png"},
            "set": {"name": "Scarlet & Violet—151"},
        },
    ]

    report = DownloadReport()
    for card in cards:
        process_card(
            card,
            assets_dir=assets,
            retries=1,
            backoff=0,
            quality=85,
            force=False,
            dry_run=False,
            report=report,
        )

    manifest_path = write_manifest(report, set_id="sv3pt5", set_name="SV151", assets_dir=assets)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(manifest)

    assert manifest["setId"] == "sv3pt5"
    assert len(manifest["cards"]) == 2
    assert len(manifest["unmapped"]) == 1
    assert manifest["unmapped"][0]["id"] == "sv3pt5-208"
    assert manifest["totalsByBucket"]["01_comum"] == 1
    assert manifest["totalsByBucket"]["05_arte_secreta"] == 1
