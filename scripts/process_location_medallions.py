#!/usr/bin/env python3

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "scripts" / "art_sources" / "location-medallions"
OUTPUT_DIR = ROOT / "public" / "assets" / "locations"
CONTACT_SHEET = ROOT / "playtest-artifacts" / "location-medallions" / "contact-sheet.png"


@dataclass(frozen=True)
class SourceSheet:
    filename: str
    columns: int
    rows: int
    keys: tuple[str, ...]


SOURCE_SHEETS = (
    SourceSheet(
        "frontier.png",
        4,
        4,
        (
            "start-village",
            "quiet-forest",
            "western-plains",
            "lake-temple",
            "sacred-lake",
            "forgotten-ruins",
            "abandoned-mine",
            "crystal-cave",
            "ancient-sewer",
            "wind-highland",
            "fallen-outpost",
            "traveler-rest",
            "dark-cave",
            "flame-canyon",
            "fire-temple",
            "dragon-nest",
        ),
    ),
    SourceSheet(
        "midlands.png",
        4,
        4,
        (
            "desert-oasis",
            "pyramid",
            "ice-citadel",
            "northern-snowfield",
            "glacial-abyss",
            "northern-fortress",
            "ancient-magic-tower",
            "machine-ruins",
            "sky-garden",
            "void-island",
            "deep-sea-corridor",
            "collapsed-magic-fortress",
            "aether-gate",
            "dimensional-rift",
            "dark-castle",
            "dark-dungeon",
        ),
    ),
    SourceSheet(
        "endgame.png",
        4,
        4,
        (
            "demon-king-castle",
            "chaos-abyss",
            "golden-kingdom",
            "underground-labyrinth",
            "sky-temple",
            "river-of-souls",
            "forbidden-library",
            "world-tree-forest",
            "ancient-temple-city",
            "rift-outpost",
            "abandoned-laboratory",
            "cursed-graveyard",
            "storm-highland",
            "aether-ruins",
            "void-corridor",
            "apocalypse-battlefield",
        ),
    ),
    SourceSheet(
        "secrets.png",
        2,
        2,
        (
            "ancient-vault",
            "spring-garden",
            "frost-storm-ruins",
            "unknown-route",
        ),
    ),
    SourceSheet("lava-zone.png", 1, 1, ("lava-zone",)),
)


def is_light_background(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) >= 180 and max(pixel) - min(pixel) <= 28


def remove_connected_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    candidate = bytearray(width * height)
    background = bytearray(width * height)
    queue: deque[int] = deque()

    for y in range(height):
        for x in range(width):
            candidate[y * width + x] = is_light_background(pixels[x, y])

    def visit(x: int, y: int) -> None:
        index = y * width + x
        if candidate[index] and not background[index]:
            background[index] = 1
            queue.append(index)

    for x in range(width):
        visit(x, 0)
        visit(x, height - 1)
    for y in range(height):
        visit(0, y)
        visit(width - 1, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x > 0:
            visit(x - 1, y)
        if x + 1 < width:
            visit(x + 1, y)
        if y > 0:
            visit(x, y - 1)
        if y + 1 < height:
            visit(x, y + 1)

    result = Image.new("RGBA", rgb.size)
    result_pixels = result.load()
    for y in range(height):
        for x in range(width):
            red, green, blue = pixels[x, y]
            alpha = 0 if background[y * width + x] else 255
            result_pixels[x, y] = (red, green, blue, alpha)
    return result


def normalize(image: Image.Image, size: int = 96, margin: int = 2) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Location crop does not contain visible artwork")

    cropped = image.crop(bbox)
    available = size - margin * 2
    scale = min(available / cropped.width, available / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.alpha_composite(
        resized,
        ((size - resized.width) // 2, (size - resized.height) // 2),
    )
    return result


def crop_cell(source: Image.Image, sheet: SourceSheet, index: int) -> Image.Image:
    column = index % sheet.columns
    row = index // sheet.columns
    left = round(column * source.width / sheet.columns)
    right = round((column + 1) * source.width / sheet.columns)
    top = round(row * source.height / sheet.rows)
    bottom = round((row + 1) * source.height / sheet.rows)
    return source.crop((left, top, right, bottom))


def save_contact_sheet(entries: list[tuple[str, Path]], tile_size: int = 144, columns: int = 8) -> None:
    rows = math.ceil(len(entries) / columns)
    label_height = 22
    sheet = Image.new("RGBA", (columns * tile_size, rows * (tile_size + label_height)), (10, 15, 23, 255))
    draw = ImageDraw.Draw(sheet)

    for index, (label, path) in enumerate(entries):
        image = Image.open(path).convert("RGBA")
        x = (index % columns) * tile_size
        y = (index // columns) * (tile_size + label_height)
        image.thumbnail((tile_size - 18, tile_size - 18), Image.Resampling.LANCZOS)
        sheet.alpha_composite(image, (x + (tile_size - image.width) // 2, y + (tile_size - image.height) // 2))
        draw.text((x + 6, y + tile_size), label, fill=(225, 232, 240, 255))

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    contact_entries: list[tuple[str, Path]] = []

    for sheet in SOURCE_SHEETS:
        source = Image.open(SOURCE_DIR / sheet.filename)
        expected_cells = sheet.columns * sheet.rows
        if len(sheet.keys) != expected_cells:
            raise ValueError(f"{sheet.filename}: expected {expected_cells} keys, got {len(sheet.keys)}")

        for index, key in enumerate(sheet.keys):
            target = OUTPUT_DIR / f"{key}.png"
            artwork = remove_connected_background(crop_cell(source, sheet, index))
            normalize(artwork).save(target)
            contact_entries.append((key, target))

    save_contact_sheet(contact_entries)
    print(f"locations={len(contact_entries)}")
    print(f"contact_sheet={CONTACT_SHEET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
