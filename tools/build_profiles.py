#!/usr/bin/env python3
"""Generate src/core/set-profiles.ts from specs/001-pokemon-booster-opener/pull-rates.json.

pull-rates.json holds, per set, the real pack structure, the sources of the pull rates and a
6-slot booster profile (see BoosterProfile in src/core/distributions.ts). This script validates
each profile against the set's manifest (slot sums, rarity strings, subsets) and writes the TS.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RATES = REPO / "specs/001-pokemon-booster-opener/pull-rates.json"
OUT = REPO / "src/core/set-profiles.ts"
ASSETS = REPO / "assets"


def slot_list(entry: dict) -> list[list[dict]]:
    """Slots in pack order; accepts the legacy {"1": [...], ...} form."""
    slots = entry["profile"]["slots"]
    return slots if isinstance(slots, list) else [slots[k] for k in sorted(slots, key=int)]


def validate(set_id: str, entry: dict) -> list[str]:
    errors: list[str] = []
    slots = slot_list(entry)
    if not slots:
        errors.append(f"{set_id}: no slots")
    if "packSize" in entry and entry["packSize"] != len(slots):
        errors.append(f"{set_id}: packSize {entry['packSize']} != {len(slots)} slots")
    manifest_path = ASSETS / set_id / "manifest.json"
    all_cards = json.loads(manifest_path.read_text())["cards"] if manifest_path.exists() else None
    cards = [c for c in all_cards if not c.get("packOnly")] if all_cards else None
    pack_only = [c for c in all_cards if c.get("packOnly")] if all_cards else []
    for key, outcomes in enumerate(slots, start=1):
        total = sum(o["p"] for o in outcomes)
        if abs(total - 1) > 1e-9:
            errors.append(f"{set_id} slot {key}: p sums to {total}")
        if cards is None:
            continue
        for o in outcomes:
            rarities = {r.lower() for r in o.get("rarities", [])}
            pool = [
                c
                for c in cards + pack_only
                if c.get("subset") == o.get("subset")
                and (not rarities or c["rarityRaw"].lower() in rarities)
                and ("bucket" not in o or rarities or c["bucket"] == o["bucket"])
            ]
            if not pool:
                errors.append(f"{set_id} slot {key}: empty pool for {o}")
    return errors


def ts_outcome(o: dict) -> str:
    parts = [f"p: {o['p']!r}"]
    if "rarities" in o:
        parts.append("rarities: [" + ", ".join(json.dumps(r) for r in o["rarities"]) + "]")
    if "bucket" in o:
        parts.append(f"bucket: {json.dumps(o['bucket'])}")
    if "subset" in o:
        parts.append(f"subset: {json.dumps(o['subset'])}")
    return "{ " + ", ".join(parts) + " }"


def main() -> int:
    data: dict = json.loads(RATES.read_text())
    errors = [e for set_id, entry in data.items() for e in validate(set_id, entry)]
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    lines = [
        "// Gerado por tools/build_profiles.py a partir de",
        "// specs/001-pokemon-booster-opener/pull-rates.json — não editar à mão.",
        "import type { BoosterProfile } from './distributions.js';",
        "",
        "export const RESEARCHED_PROFILES: Readonly<Record<string, BoosterProfile>> = {",
    ]
    for set_id, entry in data.items():
        tag = " (estimativa)" if entry.get("estimate") else ""
        lines.append(f"  // {entry['structure']}{tag}")
        lines.append(f"  {json.dumps(set_id)}: {{")
        if entry["profile"].get("keepOrder"):
            lines.append("    keepOrder: true,")
        lines.append("    slots: [")
        for outcomes in slot_list(entry):
            lines.append("      [")
            lines.extend(f"        {ts_outcome(o)}," for o in outcomes)
            lines.append("      ],")
        lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} ({len(data)} sets)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
