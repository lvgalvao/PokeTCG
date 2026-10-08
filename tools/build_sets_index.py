#!/usr/bin/env python3
"""Build assets/data/sets.json (the store's shelf index) and optimized shelf covers.

For every set that has both assets/<setId>/manifest.json and a booster profile in
specs/001-pokemon-booster-opener/pull-rates.json, writes one entry with its display name,
series/era, release date, real pack size and album size, newest first. Also writes
assets/<setId>/capa.webp (≤ 720 px tall) from capa.png, so the shelf never ships the
1 MB PNGs (constitution V).

Set metadata comes from the pokemon-tcg-data dump (same data as the pokemontcg.io API).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
RATES = REPO / "specs/001-pokemon-booster-opener/pull-rates.json"
OUT = ASSETS / "data/sets.json"
SETS_URL = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json"
COVER_MAX_HEIGHT = 720

# Store aisles, newest first. Each series from the data maps to one era.
ERAS: list[tuple[str, str, tuple[str, ...]]] = [
    ("mega", "Mega Evolution", ("Mega Evolution",)),
    ("sv", "Scarlet & Violet", ("Scarlet & Violet",)),
    ("swsh", "Sword & Shield", ("Sword & Shield",)),
    ("sm", "Sun & Moon", ("Sun & Moon",)),
    ("xy", "XY", ("XY",)),
    ("ex", "e-Card & EX", ("E-Card", "EX")),
    ("wotc", "Wizards of the Coast", ("Base", "Gym", "Neo")),
]


# Sets whose series in the data is too generic ("Other").
ERA_OVERRIDES = {"base6": "wotc"}  # Legendary Collection


def era_for(set_id: str, series: str) -> str:
    if set_id in ERA_OVERRIDES:
        return ERA_OVERRIDES[set_id]
    for key, _, series_names in ERAS:
        if series in series_names:
            return key
    raise SystemExit(f"series {series!r} has no era — add it to ERAS")


def write_cover(set_id: str) -> None:
    src = ASSETS / set_id / "capa.png"
    dest = ASSETS / set_id / "capa.webp"
    img = Image.open(src).convert("RGBA")
    if img.height > COVER_MAX_HEIGHT:
        img = img.resize(
            (round(img.width * COVER_MAX_HEIGHT / img.height), COVER_MAX_HEIGHT), Image.LANCZOS
        )
    img.save(dest, "WEBP", quality=86, method=6)


def main() -> int:
    meta = {s["id"]: s for s in requests.get(SETS_URL, timeout=60).json()}
    rates = json.loads(RATES.read_text())
    entries = []
    for set_id, rate in rates.items():
        manifest_path = ASSETS / set_id / "manifest.json"
        if not manifest_path.exists():
            continue
        manifest = json.loads(manifest_path.read_text())
        info = meta[set_id]
        slots = rate["profile"]["slots"]
        entries.append(
            {
                "id": set_id,
                "name": manifest["setName"],
                "series": info["series"],
                "era": era_for(set_id, info["series"]),
                "releaseDate": info["releaseDate"].replace("/", "-"),
                "packSize": len(slots),
                "albumSize": sum(1 for c in manifest["cards"] if not c.get("packOnly")),
                # Card-id prefixes of album subsets merged into this set (e.g. "me55c").
                "subsets": sorted(
                    {c["subset"] for c in manifest["cards"] if c.get("subset") and not c.get("packOnly")}
                ),
            }
        )
        write_cover(set_id)
    entries.sort(key=lambda e: (e["releaseDate"], e["id"]), reverse=True)
    eras = [
        {"id": key, "name": name}
        for key, name, _ in ERAS
        if any(e["era"] == key for e in entries)
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"eras": eras, "sets": entries}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(REPO)} ({len(entries)} sets, {len(eras)} eras)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
