#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def normalize_icon(source_path: Path, target_path: Path, canvas_size: int, margin: int) -> None:
    image = Image.open(source_path).convert("RGBA")
    bbox = image.getbbox()
    if bbox is None:
        normalized = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    else:
        cropped = image.crop(bbox)
        max_size = max(1, canvas_size - margin * 2)
        scale = min(max_size / cropped.width, max_size / cropped.height)
        resized = cropped.resize(
            (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
            Image.Resampling.LANCZOS,
        )
        normalized = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        x = (canvas_size - resized.width) // 2
        y = (canvas_size - resized.height) // 2
        normalized.alpha_composite(resized, (x, y))

    target_path.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(target_path)


def create_contact_sheet(paths: list[Path], output_path: Path, columns: int, canvas_size: int, gap: int) -> None:
    if not paths:
        return

    rows = math.ceil(len(paths) / columns)
    width = columns * canvas_size + gap * (columns + 1)
    height = rows * canvas_size + gap * (rows + 1)
    sheet = Image.new("RGBA", (width, height), (8, 12, 18, 255))

    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGBA")
        x = gap + (index % columns) * (canvas_size + gap)
        y = gap + (index // columns) * (canvas_size + gap)
        sheet.alpha_composite(image, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize generated item icon PNGs into a fixed transparent canvas.")
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--canvas-size", type=int, default=160)
    parser.add_argument("--margin", type=int, default=14)
    parser.add_argument("--contact-sheet", type=Path, default=None)
    parser.add_argument("--columns", type=int, default=8)
    parser.add_argument("--gap", type=int, default=12)
    args = parser.parse_args()

    source_paths = sorted(args.input_dir.glob("*.png"))
    output_paths: list[Path] = []
    for source_path in source_paths:
        target_path = args.output_dir / source_path.name
        normalize_icon(source_path, target_path, args.canvas_size, args.margin)
        output_paths.append(target_path)

    if args.contact_sheet:
        create_contact_sheet(output_paths, args.contact_sheet, args.columns, args.canvas_size, args.gap)

    print(f"normalized {len(output_paths)} icons -> {args.output_dir}")
    if args.contact_sheet:
        print(f"contact_sheet={args.contact_sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
