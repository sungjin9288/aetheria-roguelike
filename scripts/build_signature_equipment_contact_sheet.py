#!/usr/bin/env python3
"""Build one labeled review sheet for signature item and wearable exports."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


COLUMNS = 5
CARD_WIDTH = 280
CARD_HEIGHT = 220


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ):
        if path.is_file():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as source:
        value = json.load(source)
    if not isinstance(value, dict):
        raise ValueError(f"contact input must be a JSON object: {path}")
    return value


def draw_card(
    sheet: Image.Image,
    draw: ImageDraw.ImageDraw,
    left: int,
    top: int,
    height: int,
    item: Image.Image,
    overlay: Image.Image,
    name: str | None = None,
    name_font: ImageFont.FreeTypeFont | ImageFont.ImageFont | None = None,
    detail_font: ImageFont.FreeTypeFont | ImageFont.ImageFont | None = None,
) -> None:
    draw.rounded_rectangle(
        (left + 4, top + 4, left + CARD_WIDTH - 4, top + height - 4),
        radius=10,
        fill=(21, 26, 38, 255),
        outline=(57, 68, 91, 255),
        width=2,
    )
    sheet.alpha_composite(item, (left + 8, top + 8))
    sheet.alpha_composite(overlay, (left + 184, top + 14))
    draw.rectangle((left + 184, top + 94, left + 224, top + 134), fill=(7, 9, 14, 255))
    draw.rectangle((left + 232, top + 94, left + 272, top + 134), fill=(7, 9, 14, 255))
    sheet.alpha_composite(item.resize((32, 32), Image.Resampling.NEAREST), (left + 188, top + 98))
    sheet.alpha_composite(overlay.resize((32, 32), Image.Resampling.NEAREST), (left + 236, top + 98))
    if name is not None:
        draw.text((left + 10, top + 170), name, font=name_font, fill=(240, 244, 255, 255))
        draw.text((left + 10, top + 196), "item 160/32 · overlay 72/32", font=detail_font, fill=(157, 171, 199, 255))


def build(
    provenance_path: Path,
    registry_path: Path,
    public_root: Path,
    output_path: Path,
    anonymous_output_path: Path | None,
    answer_key_output_path: Path | None,
    selected_names: list[str] | None,
) -> None:
    provenance = read_json(provenance_path)
    registry = read_json(registry_path).get("entries")
    if not isinstance(registry, dict):
        raise ValueError("signature registry entries are invalid")
    rows = [
        (item, overlay)
        for batch in provenance.get("batches", [])
        for item, overlay in zip(batch.get("itemExports", []), batch.get("overlayExports", []), strict=True)
    ]
    all_names = [item.get("name") for item, _overlay in rows]
    if len(rows) != 25 or len(set(all_names)) != 25:
        raise ValueError(f"signature contact coverage must be exactly 25 identities: {len(rows)}")
    if selected_names is not None:
        if not selected_names or len(selected_names) != len(set(selected_names)):
            raise ValueError("signature contact selection must contain unique names")
        rows_by_name = {item["name"]: (item, overlay) for item, overlay in rows}
        if any(name not in rows_by_name for name in selected_names):
            raise ValueError("signature contact selection contains an unknown identity")
        rows = [rows_by_name[name] for name in selected_names]
    names = [item.get("name") for item, _overlay in rows]
    if any(name not in registry or not isinstance(registry[name].get("artNote"), str) for name in names):
        raise ValueError("signature contact identities do not bind registry art notes")

    columns = min(COLUMNS, len(rows))
    lines = (len(rows) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * CARD_WIDTH, lines * CARD_HEIGHT), (12, 15, 23, 255))
    draw = ImageDraw.Draw(sheet)
    anonymous_card_height = 180
    anonymous = Image.new(
        "RGBA",
        (columns * CARD_WIDTH, lines * anonymous_card_height),
        (12, 15, 23, 255),
    )
    anonymous_draw = ImageDraw.Draw(anonymous)
    name_font = font(18)
    detail_font = font(13)
    for index, (item_export, overlay_export) in enumerate(rows):
        column = index % columns
        line = index // columns
        left = column * CARD_WIDTH
        top = line * CARD_HEIGHT
        with Image.open(public_root / item_export["runtimePath"].lstrip("/")) as source:
            item = source.convert("RGBA")
        with Image.open(public_root / overlay_export["runtimePath"].lstrip("/")) as source:
            overlay = source.convert("RGBA")
        if item.size != (160, 160) or overlay.size != (72, 72):
            raise ValueError(f"signature contact runtime size is invalid: {item_export['name']}")

        draw_card(
            sheet,
            draw,
            left,
            top,
            CARD_HEIGHT,
            item,
            overlay,
            item_export["name"],
            name_font,
            detail_font,
        )

        anonymous_top = line * anonymous_card_height
        draw_card(anonymous, anonymous_draw, left, anonymous_top, anonymous_card_height, item, overlay)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="PNG", optimize=False)
    if anonymous_output_path is not None:
        anonymous_output_path.parent.mkdir(parents=True, exist_ok=True)
        anonymous.save(anonymous_output_path, format="PNG", optimize=False)
    if answer_key_output_path is not None:
        answer_key = {
            "version": 1,
            "order": "row-major",
            "entries": [
                {"index": index, "name": name, "artNote": registry[name]["artNote"]}
                for index, name in enumerate(names, start=1)
            ],
        }
        answer_key_output_path.parent.mkdir(parents=True, exist_ok=True)
        answer_key_output_path.write_text(
            json.dumps(answer_key, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--anonymous-output", type=Path)
    parser.add_argument("--answer-key-output", type=Path)
    parser.add_argument("--names", help="comma-separated identities for a smaller comparison sheet")
    args = parser.parse_args()
    selected_names = args.names.split(",") if args.names else None
    build(
        args.provenance.expanduser().resolve(),
        args.registry.expanduser().resolve(),
        args.public_root.expanduser().resolve(),
        args.output.expanduser().resolve(),
        args.anonymous_output.expanduser().resolve() if args.anonymous_output else None,
        args.answer_key_output.expanduser().resolve() if args.answer_key_output else None,
        selected_names,
    )


if __name__ == "__main__":
    main()
