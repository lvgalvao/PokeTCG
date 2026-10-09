"""Deixa o build (dist/) leve para publicar: cartas em WebP de 600 px e sem as capas PNG.

Roda depois de `npm run build`. Só mexe em dist/; os assets originais (assets/, Princípio V)
continuam intactos. Cada manifest.json copiado passa a apontar para os .webp.

    python3 tools/optimize_dist_images.py [dist]
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

WIDTH = 600
QUALITY = 75


def convert(jpg: Path) -> tuple[int, int]:
    before = jpg.stat().st_size
    out = jpg.with_suffix(".webp")
    with Image.open(jpg) as im:
        im = im.convert("RGB")
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY, method=6)
    jpg.unlink()
    return before, out.stat().st_size


def main() -> None:
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
    if not (dist / "index.html").exists():
        sys.exit(f"{dist} não parece um build (falta index.html). Rode `npm run build` antes.")

    jpgs = sorted(dist.glob("*/*/*.jpg"))
    with ProcessPoolExecutor() as pool:
        sizes = list(pool.map(convert, jpgs, chunksize=64))

    for manifest in dist.glob("*/manifest.json"):
        data = json.loads(manifest.read_text())
        for card in data.get("cards", []):
            if card.get("imagePath", "").endswith(".jpg"):
                card["imagePath"] = card["imagePath"][: -len(".jpg")] + ".webp"
        manifest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

    # A loja usa capa.webp; o PNG é só a fonte.
    for png in dist.glob("*/capa.png"):
        if png.with_suffix(".webp").exists():
            png.unlink()
    for junk in dist.rglob(".DS_Store"):
        junk.unlink()

    before = sum(b for b, _ in sizes)
    after = sum(a for _, a in sizes)
    print(f"{len(jpgs)} cartas: {before / 1e6:.0f} MB → {after / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
