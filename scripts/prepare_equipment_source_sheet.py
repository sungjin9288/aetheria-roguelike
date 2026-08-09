#!/usr/bin/env python3
"""Turn an image-generation working sheet into the strict tracked 3x2 source format."""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

from process_character_art import has_transparent_pixels, remove_edge_connected_background


SOURCE_SIZE = (600, 400)
CELL_SIZE = (200, 200)


def has_chroma_green_border(image: Image.Image) -> bool:
    pixels = image.load()
    width, height = image.size
    border = [pixels[x, 0][:3] for x in range(width)]
    border.extend(pixels[x, height - 1][:3] for x in range(width))
    border.extend(pixels[0, y][:3] for y in range(1, height - 1))
    border.extend(pixels[width - 1, y][:3] for y in range(1, height - 1))
    green = sum(1 for red, value, blue in border if value >= 120 and value >= red + 30 and value >= blue + 30)
    return green >= len(border) * 0.95


def remove_edge_connected_chroma_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    pending: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def is_green(x: int, y: int) -> bool:
        red, green, blue, _alpha = pixels[x, y]
        return green >= 100 and green >= red + 18 and green >= blue + 18

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_green(x, y):
            visited[index] = 1
            pending.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(1, height - 1):
        enqueue(0, y)
        enqueue(width - 1, y)

    while pending:
        x, y = pending.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)
    return rgba


def prepare_source(
    input_path: Path,
    output_path: Path,
    tolerance: int,
    used_cells: int,
) -> list[dict[str, object]]:
    if not input_path.is_file():
        raise ValueError(f"working source does not exist: {input_path}")

    with Image.open(input_path) as working:
        working.load()
        image = working.convert("RGBA")

    if image.width * SOURCE_SIZE[1] != image.height * SOURCE_SIZE[0]:
        raise ValueError(f"working source must use a 3:2 canvas: {image.size}")
    if not has_transparent_pixels(image):
        image = (
            remove_edge_connected_chroma_green(image)
            if has_chroma_green_border(image)
            else remove_edge_connected_background(image, tolerance)
        )

    if image.width % 3 or image.height % 2:
        raise ValueError(f"working source must divide into an exact 3x2 grid: {image.size}")

    working_cell_width = image.width // 3
    working_cell_height = image.height // 2
    source = Image.new("RGBA", SOURCE_SIZE, (0, 0, 0, 0))
    for index in range(6):
        column = index % 3
        row = index // 3
        working_cell = image.crop((
            column * working_cell_width,
            row * working_cell_height,
            (column + 1) * working_cell_width,
            (row + 1) * working_cell_height,
        ))
        working_alpha = working_cell.getchannel("A")
        working_bounds = working_alpha.getbbox()
        working_extrema = working_alpha.getextrema()
        if index >= used_cells:
            if working_bounds is not None or working_extrema is None or working_extrema[1] != 0:
                raise ValueError(f"working source unused trailing cell {index + 1} must be completely transparent")
            continue
        if working_bounds is None or working_extrema is None or working_extrema[0] != 0 or working_extrema[1] != 255:
            raise ValueError(f"working source cell {index + 1} requires transparent and opaque icon pixels")
        if (
            working_bounds[0] == 0
            or working_bounds[1] == 0
            or working_bounds[2] == working_cell_width
            or working_bounds[3] == working_cell_height
        ):
            raise ValueError(f"working source cell {index + 1} requires transparent boundary padding")
        prepared_cell = working_cell.resize(CELL_SIZE, Image.Resampling.LANCZOS)
        prepared_cell.paste((0, 0, 0, 0), (0, 0, CELL_SIZE[0], 1))
        prepared_cell.paste((0, 0, 0, 0), (0, CELL_SIZE[1] - 1, CELL_SIZE[0], CELL_SIZE[1]))
        prepared_cell.paste((0, 0, 0, 0), (0, 0, 1, CELL_SIZE[1]))
        prepared_cell.paste((0, 0, 0, 0), (CELL_SIZE[0] - 1, 0, CELL_SIZE[0], CELL_SIZE[1]))
        source.alpha_composite(prepared_cell, (column * CELL_SIZE[0], row * CELL_SIZE[1]))
    cells: list[dict[str, object]] = []
    for index in range(6):
        column = index % 3
        row = index // 3
        left = column * CELL_SIZE[0]
        top = row * CELL_SIZE[1]
        alpha = source.crop((left, top, left + CELL_SIZE[0], top + CELL_SIZE[1])).getchannel("A")
        extrema = alpha.getextrema()
        bounds = alpha.getbbox()
        if index >= used_cells:
            if bounds is not None or extrema is None or extrema[1] != 0:
                raise ValueError(f"prepared source unused trailing cell {index + 1} must be completely transparent")
            cells.append({"cell": index + 1, "unused": True})
            continue
        if extrema is None or extrema[0] != 0 or extrema[1] != 255 or bounds is None:
            raise ValueError(f"prepared source cell {index + 1} requires transparent and opaque icon pixels")
        if bounds[0] == 0 or bounds[1] == 0 or bounds[2] == CELL_SIZE[0] or bounds[3] == CELL_SIZE[1]:
            raise ValueError(f"prepared source cell {index + 1} requires transparent boundary padding")
        cells.append({"cell": index + 1, "bounds": list(bounds)})

    output_path.parent.mkdir(parents=True, exist_ok=True)
    source.save(output_path, format="PNG", optimize=False)
    return cells


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cleanup-tolerance", type=int, default=32)
    parser.add_argument("--used-cells", type=int, default=6)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not 0 <= args.cleanup_tolerance <= 64:
        print("--cleanup-tolerance must be between 0 and 64", file=sys.stderr)
        return 2
    if not 1 <= args.used_cells <= 6:
        print("--used-cells must be between 1 and 6", file=sys.stderr)
        return 2
    try:
        cells = prepare_source(
            args.input.expanduser().resolve(),
            args.output.expanduser().resolve(),
            args.cleanup_tolerance,
            args.used_cells,
        )
    except (OSError, ValueError) as error:
        print(f"equipment source preparation failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "size": SOURCE_SIZE, "cells": cells}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
