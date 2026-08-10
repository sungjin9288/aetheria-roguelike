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
        pixels[x, y] = (0, 0, 0, 0)
        for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
            for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                if neighbor_x != x or neighbor_y != y:
                    enqueue(neighbor_x, neighbor_y)
    return rgba


def normalize_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if pixels[x, y][3] == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def remove_boundary_chroma_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    pending: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def is_strong_green(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and green >= 100 and green >= red + 18 and green >= blue + 18

    def touches_transparency(x: int, y: int) -> bool:
        return any(
            pixels[neighbor_x, neighbor_y][3] == 0
            for neighbor_y in range(max(0, y - 1), min(height, y + 2))
            for neighbor_x in range(max(0, x - 1), min(width, x + 2))
            if neighbor_x != x or neighbor_y != y
        )

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_strong_green(x, y):
            visited[index] = 1
            pending.append((x, y))

    for y in range(height):
        for x in range(width):
            if is_strong_green(x, y) and touches_transparency(x, y):
                enqueue(x, y)

    while pending:
        x, y = pending.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
            for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                if neighbor_x != x or neighbor_y != y:
                    enqueue(neighbor_x, neighbor_y)
    return rgba


def strip_low_alpha_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if 0 < alpha < 96 and green > red and green > blue:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def is_magenta(red: int, green: int, blue: int, alpha: int) -> bool:
    return alpha > 0 and red >= 100 and blue >= 100 and red >= green + 18 and blue >= green + 18


def remove_boundary_chroma_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    pending: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def touches_transparency(x: int, y: int) -> bool:
        return any(
            pixels[neighbor_x, neighbor_y][3] == 0
            for neighbor_y in range(max(0, y - 1), min(height, y + 2))
            for neighbor_x in range(max(0, x - 1), min(width, x + 2))
            if neighbor_x != x or neighbor_y != y
        )

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index]:
            return
        if is_magenta(*pixels[x, y]):
            visited[index] = 1
            pending.append((x, y))

    for y in range(height):
        for x in range(width):
            if is_magenta(*pixels[x, y]) and touches_transparency(x, y):
                enqueue(x, y)

    while pending:
        x, y = pending.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
            for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                if neighbor_x != x or neighbor_y != y:
                    enqueue(neighbor_x, neighbor_y)
    return rgba


def strip_low_alpha_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if 0 < alpha < 96 and red > green and blue > green:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def remove_large_enclosed_magenta(image: Image.Image, minimum_size: int = 50) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    remaining = {
        y * width + x
        for y in range(height)
        for x in range(width)
        if is_magenta(*pixels[x, y])
    }
    while remaining:
        component = {remaining.pop()}
        pending = list(component)
        while pending:
            pixel = pending.pop()
            x = pixel % width
            y = pixel // width
            for neighbor in (
                pixel - 1 if x > 0 else -1,
                pixel + 1 if x < width - 1 else -1,
                pixel - width if y > 0 else -1,
                pixel + width if y < height - 1 else -1,
            ):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    pending.append(neighbor)
        if len(component) >= minimum_size:
            for pixel in component:
                pixels[pixel % width, pixel // width] = (0, 0, 0, 0)
    return rgba


def remove_tiny_islands(image: Image.Image, minimum_size: int = 20) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    remaining = {
        y * width + x
        for y in range(height)
        for x in range(width)
        if pixels[x, y][3] > 0
    }
    while remaining:
        component = {remaining.pop()}
        pending = list(component)
        while pending:
            pixel = pending.pop()
            x = pixel % width
            y = pixel // width
            for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
                for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = neighbor_y * width + neighbor_x
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        component.add(neighbor)
                        pending.append(neighbor)
        if len(component) < minimum_size:
            for pixel in component:
                pixels[pixel % width, pixel // width] = (0, 0, 0, 0)
    return rgba


def remove_enclosed_chroma_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    pending: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def is_green(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and green >= 100 and green >= red + 18 and green >= blue + 18

    def is_chroma_seed(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and green >= 180 and green >= red + 50 and green >= blue + 50

    for y in range(height):
        for x in range(width):
            if is_chroma_seed(x, y):
                index = y * width + x
                visited[index] = 1
                pending.append((x, y))

    while pending:
        x, y = pending.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
            for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                index = neighbor_y * width + neighbor_x
                if not visited[index] and is_green(neighbor_x, neighbor_y):
                    visited[index] = 1
                    pending.append((neighbor_x, neighbor_y))
    return rgba


def despill_exterior_green(image: Image.Image, depth: int = 2) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    frontier = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if pixels[x, y][3] == 0
    }
    exterior_layers: set[tuple[int, int]] = set()
    for _ in range(depth):
        next_layer: set[tuple[int, int]] = set()
        for x, y in frontier:
            for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
                for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                    point = (neighbor_x, neighbor_y)
                    if point not in exterior_layers and pixels[neighbor_x, neighbor_y][3] > 0:
                        next_layer.add(point)
        exterior_layers.update(next_layer)
        frontier = next_layer

    for x, y in exterior_layers:
        red, green, blue, alpha = pixels[x, y]
        if green <= red or green <= blue:
            continue
        if alpha < 96:
            pixels[x, y] = (0, 0, 0, 0)
        else:
            pixels[x, y] = (red, max(red, blue), blue, alpha)
    return rgba


def shrink_single_cell_source(image: Image.Image) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("working source has no visible silhouette to shrink")
    cell_width = image.width // 3
    cell_height = image.height // 2
    maximum_width = round(cell_width * 0.7)
    maximum_height = round(cell_height * 0.7)
    cropped = image.crop(bounds)
    scale = min(maximum_width / cropped.width, maximum_height / cropped.height, 1.0)
    width = max(1, round(cropped.width * scale))
    height = max(1, round(cropped.height * scale))
    resized = cropped.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    fitted = Image.new("RGBA", image.size, (0, 0, 0, 0))
    fitted.alpha_composite(resized, ((cell_width - width) // 2, (cell_height - height) // 2))
    return normalize_transparent_rgb(fitted)


def shrink_cell_content(cell: Image.Image) -> Image.Image:
    bounds = cell.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("working source selected shrink cell has no visible silhouette")
    cropped = cell.crop(bounds)
    maximum_width = round(cell.width * 0.7)
    maximum_height = round(cell.height * 0.7)
    scale = min(maximum_width / cropped.width, maximum_height / cropped.height, 1.0)
    width = max(1, round(cropped.width * scale))
    height = max(1, round(cropped.height * scale))
    resized = cropped.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    fitted = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    fitted.alpha_composite(resized, ((cell.width - width) // 2, (cell.height - height) // 2))
    return normalize_transparent_rgb(fitted)


def prepare_source(
    input_path: Path,
    output_path: Path,
    tolerance: int,
    used_cells: int,
    preserve_green_cells: frozenset[int],
    remove_enclosed_green_cells: frozenset[int],
    strip_low_alpha_green_edges: bool,
    shrink_cells: frozenset[int],
    remove_enclosed_magenta_cells: frozenset[int],
    strip_low_alpha_magenta_edges: bool,
    remove_tiny_islands_cells: frozenset[int],
    approved_source_path: Path | None,
    preserved_cells: frozenset[int],
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
    image = normalize_transparent_rgb(image)

    approved_source = None
    if approved_source_path is not None:
        with Image.open(approved_source_path) as approved:
            approved.load()
            if approved.size != SOURCE_SIZE or approved.mode != "RGBA":
                raise ValueError("approved source must be a 600x400 RGBA PNG")
            approved_source = normalize_transparent_rgb(approved.copy())

    if image.width % 3 or image.height % 2:
        raise ValueError(f"working source must divide into an exact 3x2 grid: {image.size}")
    fit_entire_source = used_cells == 1 and shrink_cells == frozenset({1})
    if fit_entire_source:
        image = shrink_single_cell_source(image)

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
        if index + 1 in shrink_cells and not fit_entire_source:
            working_cell = shrink_cell_content(working_cell)
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
        prepared_cell = (
            working_cell.convert("RGBa")
            .resize(CELL_SIZE, Image.Resampling.LANCZOS)
            .convert("RGBA")
        )
        if index + 1 in remove_enclosed_green_cells:
            prepared_cell = remove_enclosed_chroma_green(prepared_cell)
        if index + 1 in remove_enclosed_magenta_cells:
            prepared_cell = remove_large_enclosed_magenta(prepared_cell)
        if strip_low_alpha_magenta_edges:
            prepared_cell = remove_boundary_chroma_magenta(prepared_cell)
            prepared_cell = strip_low_alpha_magenta(prepared_cell)
        if index + 1 in remove_tiny_islands_cells:
            prepared_cell = remove_tiny_islands(prepared_cell)
        if index + 1 not in preserve_green_cells:
            prepared_cell = remove_boundary_chroma_green(prepared_cell)
            prepared_cell = despill_exterior_green(prepared_cell)
            if strip_low_alpha_green_edges:
                prepared_cell = strip_low_alpha_green(prepared_cell)
        prepared_cell.paste((0, 0, 0, 0), (0, 0, CELL_SIZE[0], 1))
        prepared_cell.paste((0, 0, 0, 0), (0, CELL_SIZE[1] - 1, CELL_SIZE[0], CELL_SIZE[1]))
        prepared_cell.paste((0, 0, 0, 0), (0, 0, 1, CELL_SIZE[1]))
        prepared_cell.paste((0, 0, 0, 0), (CELL_SIZE[0] - 1, 0, CELL_SIZE[0], CELL_SIZE[1]))
        if index + 1 in preserved_cells:
            left = column * CELL_SIZE[0]
            top = row * CELL_SIZE[1]
            prepared_cell = approved_source.crop((left, top, left + CELL_SIZE[0], top + CELL_SIZE[1]))
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
    parser.add_argument("--preserve-green-cells", default="")
    parser.add_argument("--remove-enclosed-green-cells", default="")
    parser.add_argument("--strip-low-alpha-green", action="store_true")
    parser.add_argument("--shrink-cells", default="")
    parser.add_argument("--remove-enclosed-magenta-cells", default="")
    parser.add_argument("--strip-low-alpha-magenta", action="store_true")
    parser.add_argument("--remove-tiny-islands-cells", default="")
    parser.add_argument("--preserve-cells-from", type=Path)
    parser.add_argument("--preserve-cells", default="")
    return parser


def parse_used_cells(value: str, option: str, used_cells: int) -> frozenset[int]:
    try:
        cells = frozenset(int(cell) for cell in value.split(",") if cell)
    except ValueError as error:
        raise ValueError(f"{option} must be a comma-separated cell list") from error
    if any(cell < 1 or cell > used_cells for cell in cells):
        raise ValueError(f"{option} must reference used cells")
    return cells


def main() -> int:
    args = build_parser().parse_args()
    if not 0 <= args.cleanup_tolerance <= 64:
        print("--cleanup-tolerance must be between 0 and 64", file=sys.stderr)
        return 2
    if not 1 <= args.used_cells <= 6:
        print("--used-cells must be between 1 and 6", file=sys.stderr)
        return 2
    try:
        preserve_green_cells = parse_used_cells(
            args.preserve_green_cells, "--preserve-green-cells", args.used_cells,
        )
        remove_enclosed_green_cells = parse_used_cells(
            args.remove_enclosed_green_cells, "--remove-enclosed-green-cells", args.used_cells,
        )
        shrink_cells = parse_used_cells(args.shrink_cells, "--shrink-cells", args.used_cells)
        remove_enclosed_magenta_cells = parse_used_cells(
            args.remove_enclosed_magenta_cells, "--remove-enclosed-magenta-cells", args.used_cells,
        )
        remove_tiny_islands_cells = parse_used_cells(
            args.remove_tiny_islands_cells, "--remove-tiny-islands-cells", args.used_cells,
        )
        preserved_cells = parse_used_cells(args.preserve_cells, "--preserve-cells", args.used_cells)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    if preserve_green_cells.intersection(remove_enclosed_green_cells):
        print("green cell preservation and enclosed removal cannot overlap", file=sys.stderr)
        return 2
    if bool(preserved_cells) != bool(args.preserve_cells_from):
        print("--preserve-cells and --preserve-cells-from must be used together", file=sys.stderr)
        return 2
    try:
        cells = prepare_source(
            args.input.expanduser().resolve(),
            args.output.expanduser().resolve(),
            args.cleanup_tolerance,
            args.used_cells,
            preserve_green_cells,
            remove_enclosed_green_cells,
            args.strip_low_alpha_green,
            shrink_cells,
            remove_enclosed_magenta_cells,
            args.strip_low_alpha_magenta,
            remove_tiny_islands_cells,
            args.preserve_cells_from.expanduser().resolve() if args.preserve_cells_from else None,
            preserved_cells,
        )
    except (OSError, ValueError) as error:
        print(f"equipment source preparation failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "size": SOURCE_SIZE, "cells": cells}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
