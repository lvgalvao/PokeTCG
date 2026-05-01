#!/usr/bin/env python3
"""Generate temporary placeholder cover images (capa.png) for sets that don't have one yet.

Reads each `assets/<setId>/manifest.json` and, if `capa.png` is missing, emits a 488x896
gradient-with-text PNG so the booster pack is visually identifiable. Colors are derived
deterministically from `setId`. Idempotent — never overwrites existing covers.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
COVER_SIZE = (488, 896)


def colors_for(set_id: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    h = hashlib.sha1(set_id.encode()).digest()
    base = (h[0] % 200 + 30, h[1] % 200 + 30, h[2] % 200 + 30)
    accent = (h[3] % 160 + 60, h[4] % 160 + 60, h[5] % 160 + 60)
    return base, accent


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render_cover(set_id: str, set_name: str, dest: Path) -> None:
    w, h = COVER_SIZE
    base, accent = colors_for(set_id)
    img = Image.new("RGB", (w, h), base)
    px = img.load()
    for y in range(h):
        t = y / h
        r = int(base[0] * (1 - t) + accent[0] * t)
        g = int(base[1] * (1 - t) + accent[1] * t)
        b = int(base[2] * (1 - t) + accent[2] * t)
        for x in range(w):
            px[x, y] = (r, g, b)

    draw = ImageDraw.Draw(img)
    diag = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    diag_draw = ImageDraw.Draw(diag)
    for k in range(-h, w + h, 60):
        diag_draw.line([(k, 0), (k + h, h)], fill=(255, 255, 255, 18), width=2)
    img.paste(Image.alpha_composite(img.convert("RGBA"), diag).convert("RGB"))

    title_font = load_font(72)
    sub_font = load_font(40)
    tag_font = load_font(28)

    name_lines: list[str] = []
    words = set_name.split()
    line = ""
    for word in words:
        candidate = (line + " " + word).strip()
        bbox = title_font.getbbox(candidate)
        if bbox[2] - bbox[0] > w - 60 and line:
            name_lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        name_lines.append(line)

    block_h = sum(title_font.getbbox(l)[3] - title_font.getbbox(l)[1] for l in name_lines) + (len(name_lines) - 1) * 12
    y = (h - block_h) // 2 - 40
    for ln in name_lines:
        bbox = title_font.getbbox(ln)
        tw = bbox[2] - bbox[0]
        x = (w - tw) // 2
        draw.text((x + 3, y + 3), ln, font=title_font, fill=(0, 0, 0, 160))
        draw.text((x, y), ln, font=title_font, fill=(255, 255, 255))
        y += (bbox[3] - bbox[1]) + 12

    sid = set_id.upper()
    bbox = sub_font.getbbox(sid)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, y + 30), sid, font=sub_font, fill=(255, 255, 255, 220))

    tag = "CAPA TEMPORÁRIA"
    bbox = tag_font.getbbox(tag)
    tw = bbox[2] - bbox[0]
    draw.rectangle(
        [((w - tw) // 2 - 14, h - 90), ((w + tw) // 2 + 14, h - 50)],
        fill=(0, 0, 0, 180),
    )
    draw.text(((w - tw) // 2, h - 86), tag, font=tag_font, fill=(255, 255, 255))

    draw.rectangle([(0, 0), (w - 1, h - 1)], outline=(255, 255, 255), width=6)

    tmp = dest.with_suffix(".png.tmp")
    img.save(tmp, format="PNG", optimize=True)
    tmp.replace(dest)


def main() -> int:
    if not ASSETS_DIR.is_dir():
        print(f"assets/ not found at {ASSETS_DIR}", file=sys.stderr)
        return 1

    created = 0
    skipped = 0
    for manifest_path in sorted(ASSETS_DIR.glob("*/manifest.json")):
        set_dir = manifest_path.parent
        set_id = set_dir.name
        cover = set_dir / "capa.png"
        if cover.exists():
            skipped += 1
            continue
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[skip] {set_id}: cannot read manifest ({exc})", file=sys.stderr)
            continue
        set_name = data.get("setName") or set_id
        render_cover(set_id, set_name, cover)
        print(f"[create] {set_id} ({set_name}) -> {cover.relative_to(ASSETS_DIR.parent)}")
        created += 1

    print(f"[summary] created={created} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
