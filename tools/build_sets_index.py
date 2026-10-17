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
    ("bw", "Black & White", ("Black & White",)),
    ("hgss", "HeartGold & SoulSilver", ("HeartGold & SoulSilver",)),
    ("dp", "Diamond & Pearl", ("Diamond & Pearl", "Platinum")),
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


def norm(name: str) -> str:
    return "".join(name.lower().split())


def classic_origins(entries: list[dict], manifests: dict[str, dict]) -> list[dict]:
    """Cada Clássica do 30 anos (me55c) e a carta original de onde veio: mesmo nome e número,
    de preferência a mesma raridade, na coleção mais antiga da loja que a tem (ex.:
    Charizard 4 → Base Set, não Base Set 2)."""
    me55 = manifests.get("me55")
    if not me55:
        return []
    released = {e["id"]: e["releaseDate"] for e in entries}
    out = []
    for c in me55["cards"]:
        if c.get("subset") != "me55c":
            continue
        matches = [
            (released[sid], sid, o)
            for sid, m in manifests.items()
            if sid != "me55"
            for o in m["cards"]
            if not o.get("subset") and not o.get("packOnly")
            and o["collectionNumber"] == c["collectionNumber"] and norm(o["name"]) == norm(c["name"])
        ]
        if not matches:
            print(f"  aviso: Clássica sem origem na loja: {c['id']} {c['name']}")
            continue
        # Mesma raridade primeiro (Gengar Prime 94 é do Triumphant, não o Gengar 94 do 151).
        date, sid, o = min(matches, key=lambda t: (norm(t[2]["rarityRaw"]) != norm(c["rarityRaw"]), t[0]))
        out.append({
            "id": c["id"],
            "name": c["name"],
            "origin": o["id"],
            "originImage": o["imagePath"],
            "set": sid,
            "year": int(date[:4]),
            "_rank": (o["rarityRaw"] != "LEGEND", o["bucket"]),
        })
    # A mais icônica primeiro (é a que espia do pacote): maior raridade; meia carta LEGEND por último.
    out.sort(key=lambda c: c.pop("_rank"), reverse=True)
    return out


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
    manifests: dict[str, dict] = {}
    for set_id, rate in rates.items():
        manifest_path = ASSETS / set_id / "manifest.json"
        if not manifest_path.exists():
            continue
        manifest = json.loads(manifest_path.read_text())
        manifests[set_id] = manifest
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
        json.dumps(
            {"eras": eras, "sets": entries, "classics": classic_origins(entries, manifests)},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(REPO)} ({len(entries)} sets, {len(eras)} eras)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
