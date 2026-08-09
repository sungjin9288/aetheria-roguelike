#!/usr/bin/env python3
"""Build the 160px and 32px review sheet for accepted family exemplars."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


COLUMNS = 6
CARD_WIDTH = 230
CARD_HEIGHT = 210


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ):
        if path.is_file():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def read_json(path: Path) -> object:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def build(provenance_path: Path, public_root: Path, output: Path) -> None:
    provenance = read_json(provenance_path)
    exports = [
        entry
        for batch in provenance.get("batches", [])
        for entry in batch.get("exports", [])
    ]
    exports.sort(key=lambda entry: entry["familyKey"])
    family_keys = [entry["familyKey"] for entry in exports]
    if len(exports) != 22 or len(set(family_keys)) != 22:
        raise ValueError(f"family contact sheet requires 22 unique exports, found {len(set(family_keys))}")

    rows = (len(exports) + COLUMNS - 1) // COLUMNS
    sheet = Image.new("RGBA", (COLUMNS * CARD_WIDTH, rows * CARD_HEIGHT), (12, 15, 23, 255))
    draw = ImageDraw.Draw(sheet)
    label_font = font(17)

    for index, entry in enumerate(exports):
        column = index % COLUMNS
        row = index // COLUMNS
        left = column * CARD_WIDTH
        top = row * CARD_HEIGHT
        draw.rounded_rectangle(
            (left + 4, top + 4, left + CARD_WIDTH - 4, top + CARD_HEIGHT - 4),
            radius=10,
            fill=(21, 26, 38, 255),
            outline=(57, 68, 91, 255),
            width=2,
        )
        runtime_path = public_root / entry["runtimePath"].lstrip("/")
        with Image.open(runtime_path) as image:
            icon = image.convert("RGBA")
        if icon.size != (160, 160):
            raise ValueError(f"family runtime is not 160x160: {entry['familyKey']}")
        sheet.alpha_composite(icon, (left + 8, top + 8))
        preview = icon.resize((32, 32), Image.Resampling.NEAREST)
        draw.rectangle((left + 181, top + 14, left + 221, top + 54), fill=(7, 9, 14, 255))
        sheet.alpha_composite(preview, (left + 185, top + 18))
        draw.text((left + 10, top + 174), entry["familyKey"], font=label_font, fill=(240, 244, 255, 255))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build(
        args.provenance.expanduser().resolve(),
        args.public_root.expanduser().resolve(),
        args.output.expanduser().resolve(),
    )


if __name__ == "__main__":
    main()
