#!/usr/bin/env python3
"""Download all cards of a Pokémon TCG set and organize them under assets/.

Implements FR-001 .. FR-007a from the feature spec and the contract in
specs/001-pokemon-booster-opener/contracts/download-cli.md.

Idempotent. Maps source rarities to 7 local buckets. Generates assets/manifest.json.
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests
from PIL import Image

DOWNLOADER_VERSION = "0.1.0"
API_BASE = "https://api.pokemontcg.io/v2"

BUCKETS = (
    "01_comum",
    "02_incomum",
    "03_raras",
    "04_duplo_raras",
    "05_arte_secreta",
    "06_duplo_arte_secreta",
    "07_legendaria",
)

# FR-003: rarity-source → local bucket. Comparison is case-insensitive on rarity-raw.
RARITY_TO_BUCKET: dict[str, str] = {
    "common": "01_comum",
    "uncommon": "02_incomum",
    "rare": "03_raras",
    "rare holo": "03_raras",
    "double rare": "04_duplo_raras",
    "rare ultra": "04_duplo_raras",
    "ultra rare": "04_duplo_raras",
    "rare holo ex": "04_duplo_raras",
    "rare holo gx": "04_duplo_raras",
    "rare holo v": "04_duplo_raras",
    "rare holo vmax": "04_duplo_raras",
    "illustration rare": "05_arte_secreta",
    "special illustration rare": "06_duplo_arte_secreta",
    "rare rainbow": "06_duplo_arte_secreta",
    "rare secret": "06_duplo_arte_secreta",
    "hyper rare": "07_legendaria",
    "ace spec rare": "07_legendaria",
    "black white rare": "07_legendaria",
    "mega_attack_rare": "07_legendaria",
    "mega hyper rare": "07_legendaria",
}

# Allowed characters in a card id for path-safety (FR-007).
CARD_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")

log = logging.getLogger("pkmn-cards")


def bucket_for(rarity_raw: str | None) -> str | None:
    """Map a source rarity string to a local bucket. Case-insensitive. None if unmapped."""
    if not rarity_raw:
        return None
    return RARITY_TO_BUCKET.get(rarity_raw.strip().lower())


def is_safe_card_id(card_id: str) -> bool:
    """Refuse path traversal and separators in card ids (FR-007)."""
    return bool(CARD_ID_PATTERN.match(card_id)) and ".." not in card_id


def ensure_buckets(assets_dir: Path) -> None:
    """Create the 7 official bucket subdirectories. Refuses to create others."""
    assets_dir.mkdir(parents=True, exist_ok=True)
    for b in BUCKETS:
        (assets_dir / b).mkdir(parents=True, exist_ok=True)


def list_latest_sets(
    count: int, api_key: str | None = None
) -> list[dict[str, Any]]:
    """Return the `count` most recently released sets (newest first)."""
    headers = {"X-Api-Key": api_key} if api_key else {}
    params = {"orderBy": "-releaseDate", "page": 1, "pageSize": count}
    r = requests.get(f"{API_BASE}/sets", params=params, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json().get("data", [])[:count]


def list_set_cards(
    set_id: str, api_key: str | None = None, page_size: int = 250
) -> list[dict[str, Any]]:
    """Iterate paginated /v2/cards filtered by set.id. Returns the raw card dicts."""
    headers = {"X-Api-Key": api_key} if api_key else {}
    cards: list[dict[str, Any]] = []
    page = 1
    while True:
        params = {"q": f"set.id:{set_id}", "page": page, "pageSize": page_size}
        log.debug("Listing %s page %d", set_id, page)
        r = requests.get(f"{API_BASE}/cards", params=params, headers=headers, timeout=30)
        r.raise_for_status()
        body = r.json()
        batch = body.get("data", [])
        cards.extend(batch)
        total = body.get("totalCount", len(cards))
        if len(batch) < page_size or len(cards) >= total:
            break
        page += 1
    return cards


def download_image(
    url: str, retries: int = 3, backoff: float = 1.0
) -> bytes:
    """Fetch an image with finite retries and exponential backoff."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return r.content
        except (requests.RequestException, requests.HTTPError) as exc:
            last_exc = exc
            wait = backoff * (2**attempt)
            log.debug("Attempt %d failed for %s: %s; waiting %.1fs", attempt + 1, url, exc, wait)
            time.sleep(wait)
    raise RuntimeError(f"Failed to download {url} after {retries} attempts: {last_exc}")


def to_jpg(src_bytes: bytes, dest_path: Path, quality: int = 85) -> None:
    """Convert image bytes to JPG, flattening transparency against white. Atomic write."""
    with Image.open(io.BytesIO(src_bytes)) as im:
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            background = Image.new("RGB", im.size, (255, 255, 255))
            rgba = im.convert("RGBA")
            background.paste(rgba, mask=rgba.split()[-1])
            converted = background
        else:
            converted = im.convert("RGB")

        tmp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
        converted.save(tmp_path, format="JPEG", quality=quality, optimize=True)
        os.replace(tmp_path, dest_path)


def card_image_url(card: dict[str, Any]) -> str | None:
    images = card.get("images") or {}
    return images.get("large") or images.get("small")


@dataclass
class DownloadReport:
    downloaded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)
    unmapped: list[dict[str, str]] = field(default_factory=list)
    cards_for_manifest: list[dict[str, Any]] = field(default_factory=list)


def process_card(
    card: dict[str, Any],
    assets_dir: Path,
    retries: int,
    backoff: float,
    quality: int,
    force: bool,
    dry_run: bool,
    report: DownloadReport,
) -> None:
    card_id = card.get("id", "")
    name = card.get("name", "")
    rarity_raw = card.get("rarity", "")

    if not is_safe_card_id(card_id):
        report.failed.append((card_id, "unsafe card id"))
        return

    bucket = bucket_for(rarity_raw)
    if bucket is None:
        report.unmapped.append({"id": card_id, "name": name, "rarityRaw": rarity_raw})
        log.debug("Unmapped rarity for %s (%s): %r", card_id, name, rarity_raw)
        return

    dest = assets_dir / bucket / f"{card_id}.jpg"
    rel_path = f"{assets_dir.name}/{bucket}/{card_id}.jpg"
    collection_number_raw = card.get("number", "0")
    try:
        collection_number = int(re.sub(r"[^0-9]", "", collection_number_raw) or "0")
    except (TypeError, ValueError):
        collection_number = 0

    manifest_entry = {
        "id": card_id,
        "name": name,
        "rarityRaw": rarity_raw,
        "bucket": bucket,
        "collectionNumber": collection_number,
        "imagePath": rel_path,
    }

    if dest.exists() and not force:
        report.skipped.append(card_id)
        report.cards_for_manifest.append(manifest_entry)
        return

    if dry_run:
        report.downloaded.append(card_id)
        report.cards_for_manifest.append(manifest_entry)
        return

    image_url = card_image_url(card)
    if not image_url:
        report.failed.append((card_id, "no image url"))
        return

    try:
        raw = download_image(image_url, retries=retries, backoff=backoff)
        to_jpg(raw, dest, quality=quality)
        report.downloaded.append(card_id)
        report.cards_for_manifest.append(manifest_entry)
    except Exception as exc:  # noqa: BLE001
        report.failed.append((card_id, str(exc)))
        log.warning("Failed for %s: %s", card_id, exc)


def write_manifest(
    report: DownloadReport,
    set_id: str,
    set_name: str,
    assets_dir: Path,
) -> Path:
    cards = sorted(report.cards_for_manifest, key=lambda c: (c["bucket"], c["collectionNumber"]))
    totals: dict[str, int] = {b: 0 for b in BUCKETS}
    for card in cards:
        totals[card["bucket"]] += 1

    manifest = {
        "setId": set_id,
        "setName": set_name,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
            "+00:00", "Z"
        ),
        "downloaderVersion": DOWNLOADER_VERSION,
        "totalSet": len(cards),
        "cards": cards,
        "totalsByBucket": totals,
        "unmapped": report.unmapped,
    }

    path = assets_dir / "manifest.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return path


def print_report(report: DownloadReport, manifest_path: Path | None) -> None:
    print(
        f"[pkmn-cards] downloaded={len(report.downloaded)}  "
        f"skipped={len(report.skipped)}  "
        f"failed={len(report.failed)}  "
        f"unmapped={len(report.unmapped)}"
    )
    if manifest_path is not None:
        print(f"[pkmn-cards] manifest:    {manifest_path}")
    if report.failed:
        print("[pkmn-cards] failed:")
        for cid, reason in report.failed:
            print(f"  - {cid} ({reason})")
    if report.unmapped:
        print("[pkmn-cards] unmapped:")
        for u in report.unmapped:
            print(f"  - {u['id']} \"{u['name']}\" (rarity={u['rarityRaw']!r})")


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="download_cards.py",
        description="Download all cards of a Pokémon TCG set and organize them under assets/.",
    )
    p.add_argument("--set-id", default="sv3pt5")
    p.add_argument(
        "--latest",
        type=int,
        default=None,
        metavar="N",
        help="Download the N most recent sets (overrides --set-id).",
    )
    p.add_argument("--assets-dir", default="./assets", type=Path)
    p.add_argument("--api-key", default=os.environ.get("POKEMONTCG_API_KEY"))
    p.add_argument("--retries", type=int, default=3)
    p.add_argument("--retry-backoff", type=float, default=1.0)
    p.add_argument("--quality", type=int, default=85)
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args(list(argv) if argv is not None else None)


def download_set(set_id: str, set_name_hint: str | None, args: argparse.Namespace) -> int:
    """Download a single set. Returns an exit-style code (0 ok, 2 partial fail, 3 fatal)."""
    assets_dir: Path = args.assets_dir.resolve() / set_id
    ensure_buckets(assets_dir)

    try:
        cards = list_set_cards(set_id, args.api_key)
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to list set %s: %s", set_id, exc)
        return 3

    if not cards:
        log.error("Empty set %s", set_id)
        return 3

    set_name = (cards[0].get("set") or {}).get("name") or set_name_hint or set_id
    report = DownloadReport()

    print(f"[pkmn-cards] === {set_id} \"{set_name}\" ({len(cards)} cards) ===")
    for card in cards:
        process_card(
            card,
            assets_dir=assets_dir,
            retries=args.retries,
            backoff=args.retry_backoff,
            quality=args.quality,
            force=args.force,
            dry_run=args.dry_run,
            report=report,
        )

    manifest_path = write_manifest(report, set_id=set_id, set_name=set_name, assets_dir=assets_dir)
    print_report(report, manifest_path)

    return 2 if report.failed else 0


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    if args.latest is not None and args.latest > 0:
        try:
            sets = list_latest_sets(args.latest, args.api_key)
        except Exception as exc:  # noqa: BLE001
            log.error("Failed to list latest sets: %s", exc)
            return 3
        if not sets:
            log.error("No sets returned by API")
            return 3
        targets = [(s.get("id", ""), s.get("name")) for s in sets if s.get("id")]
    else:
        targets = [(args.set_id, None)]

    worst = 0
    for set_id, name_hint in targets:
        rc = download_set(set_id, name_hint, args)
        worst = max(worst, rc)
    return worst


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
