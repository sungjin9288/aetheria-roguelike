#!/usr/bin/env python3
"""Build a labeled 160px and 32px equipment review sheet from accepted provenance."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


COLUMNS = 6
CELL_WIDTH = 230
CELL_HEIGHT = 220


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ):
        if path.is_file():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def read_json(path: Path) -> object:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def build(catalog_path: Path, provenance_path: Path, public_root: Path, output: Path) -> None:
    catalog = read_json(catalog_path)
    provenance = read_json(provenance_path)
    if not isinstance(catalog, list) or not isinstance(provenance, dict):
        raise ValueError("catalog and provenance must be structured JSON")
    cohort = provenance.get("cohort")
    rows = [row for row in catalog if row.get("cohort") == cohort]
    rows.sort(key=lambda row: (row["familyKey"], row["tier"], row["name"]))
    exports = {
        entry["name"]: entry
        for batch in provenance.get("batches", [])
        for entry in batch.get("exports", [])
    }
    if len(rows) != len(exports) or any(row["name"] not in exports for row in rows):
        raise ValueError(f"contact sheet provenance coverage is incomplete: {len(exports)}/{len(rows)}")

    row_count = (len(rows) + COLUMNS - 1) // COLUMNS
    sheet = Image.new("RGBA", (COLUMNS * CELL_WIDTH, row_count * CELL_HEIGHT), (12, 15, 23, 255))
    draw = ImageDraw.Draw(sheet)
    name_font = font(18)
    detail_font = font(14)

    for index, row in enumerate(rows):
        column = index % COLUMNS
        line = index // COLUMNS
        left = column * CELL_WIDTH
        top = line * CELL_HEIGHT
        draw.rounded_rectangle(
            (left + 4, top + 4, left + CELL_WIDTH - 4, top + CELL_HEIGHT - 4),
            radius=10,
            fill=(21, 26, 38, 255),
            outline=(57, 68, 91, 255),
            width=2,
        )
        runtime = public_root / row["runtimePath"].lstrip("/")
        with Image.open(runtime) as image:
            icon = image.convert("RGBA")
        sheet.alpha_composite(icon, (left + 8, top + 8))
        preview = icon.resize((32, 32), Image.Resampling.NEAREST)
        draw.rectangle((left + 181, top + 14, left + 221, top + 54), fill=(7, 9, 14, 255))
        sheet.alpha_composite(preview, (left + 185, top + 18))
        draw.text((left + 10, top + 170), row["name"], font=name_font, fill=(240, 244, 255, 255))
        detail = f"{row['familyKey']} · T{row['tier']} · {row.get('elem') or '무속성'}"
        draw.text((left + 10, top + 194), detail, font=detail_font, fill=(157, 171, 199, 255))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build(
        args.catalog.expanduser().resolve(),
        args.provenance.expanduser().resolve(),
        args.public_root.expanduser().resolve(),
        args.output.expanduser().resolve(),
    )


if __name__ == "__main__":
    main()
