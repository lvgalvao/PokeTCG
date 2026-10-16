#!/usr/bin/env python3
"""Build assets/<setId>/battle.json: HP, type, weakness and attacks of each Pokémon card.

The battle mode plays with the card's own numbers. For every set in assets/data/sets.json
(and the subsets folded into its album), reads the card data from the pokemon-tcg-data dump
and writes one compact entry per Pokémon card that is in the set's manifest:

    { "base1-4": { "hp": 120, "type": "Fire", "weak": "Water", "attacks": [["Fire Spin", 100]] } }

Trainers and Energy have no HP and are left out, so they cannot be picked for battle.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import requests

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
SETS_INDEX = ASSETS / "data/sets.json"
CARDS_URL = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{set_id}.json"


def parse_damage(raw: str | None) -> int:
    """'30' → 30, '50+' → 50, '20×' → 20, '' → 0 (attack with effect only)."""
    m = re.match(r"\d+", raw or "")
    return int(m.group()) if m else 0


def battle_entry(card: dict[str, Any]) -> dict[str, Any] | None:
    """Compact battle stats of a card, or None when it is not a Pokémon with HP."""
    if card.get("supertype") != "Pokémon":
        return None
    hp = parse_damage(card.get("hp"))
    if hp <= 0:
        return None
    entry: dict[str, Any] = {
        "hp": hp,
        "type": (card.get("types") or ["Colorless"])[0],
        "attacks": [[a.get("name") or "Ataque", parse_damage(a.get("damage"))] for a in card.get("attacks") or []],
    }
    weaknesses = card.get("weaknesses") or []
    if weaknesses:
        entry["weak"] = weaknesses[0]["type"]
    return entry


def build_set(set_id: str, subsets: list[str]) -> int:
    manifest = json.loads((ASSETS / set_id / "manifest.json").read_text(encoding="utf-8"))
    wanted = {c["id"] for c in manifest["cards"]}
    out: dict[str, Any] = {}
    # Any other id prefix in the manifest (ex.: `sve` energies) is a non-Pokémon extra.
    for source in [set_id, *subsets]:
        r = requests.get(CARDS_URL.format(set_id=source), timeout=60)
        r.raise_for_status()
        for card in r.json():
            entry = battle_entry(card)
            if entry and card["id"] in wanted:
                out[card["id"]] = entry
    path = ASSETS / set_id / "battle.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(out)


def main() -> int:
    sets = json.loads(SETS_INDEX.read_text(encoding="utf-8"))["sets"]
    failed = 0
    for s in sets:
        try:
            n = build_set(s["id"], s.get("subsets", []))
            print(f"{s['id']:>12}  {n:4d} pokémon")
        except (requests.RequestException, OSError, ValueError) as exc:
            failed += 1
            print(f"{s['id']:>12}  FALHOU: {exc}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
