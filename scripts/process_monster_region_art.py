#!/usr/bin/env python3

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "scripts" / "art_sources" / "monster-region"
MONSTER_DIR = ROOT / "public" / "assets" / "monsters"
REGION_DIR = ROOT / "public" / "assets" / "regions"
CONTACT_SHEET = ROOT / "playtest-artifacts" / "monster-region-art" / "contact-sheet.png"


@dataclass(frozen=True)
class ArtCrop:
    source: str
    family: str
    key: str
    crop: tuple[int, int, int, int]


# The source sheets intentionally stay in the repository. These explicit crop
# coordinates make every runtime asset reproducible without a manual image edit.
MONSTER_CROPS = (
    ArtCrop("forest.png", "forest", "slime", (40, 260, 360, 505)),
    ArtCrop("forest.png", "forest", "wolf", (390, 90, 770, 500)),
    ArtCrop("forest.png", "forest", "forest-spirit", (780, 70, 1100, 505)),
    ArtCrop("forest.png", "forest", "spider-swarm", (1100, 130, 1510, 505)),
    ArtCrop("forest.png", "forest", "poison-mushroom", (35, 550, 380, 910)),
    ArtCrop("forest.png", "forest", "stag-beetle", (390, 540, 850, 930)),
    ArtCrop("forest.png", "forest", "forest-fairy", (840, 540, 1210, 920)),
    ArtCrop("plains.png", "plains", "boar", (60, 40, 470, 460)),
    ArtCrop("plains.png", "plains", "wild-dog", (560, 50, 1000, 470)),
    ArtCrop("plains.png", "plains", "kobold", (1030, 50, 1450, 470)),
    ArtCrop("plains.png", "plains", "green-slime", (100, 620, 470, 920)),
    ArtCrop("plains.png", "plains", "plains-bandit", (550, 520, 960, 920)),
    ArtCrop("ruins.png", "ruins", "skeleton-soldier", (50, 35, 500, 480)),
    ArtCrop("ruins.png", "ruins", "goblin", (550, 55, 980, 480)),
    ArtCrop("ruins.png", "ruins", "stone-guardian", (1030, 35, 1500, 490)),
    ArtCrop("ruins.png", "ruins", "ghost-knight", (40, 520, 500, 970)),
    ArtCrop("ruins.png", "ruins", "ruins-ghoul", (550, 540, 970, 950)),
    ArtCrop("fire.png", "fire", "fire-spirit", (80, 40, 440, 485)),
    ArtCrop("fire.png", "fire", "lava-golem", (530, 45, 1000, 500)),
    ArtCrop("fire.png", "fire", "fire-bat", (1020, 55, 1480, 490)),
    ArtCrop("fire.png", "fire", "fire-lizard", (50, 580, 500, 960)),
    ArtCrop("fire.png", "fire", "fire-lord", (520, 530, 1010, 990)),
    ArtCrop("fire.png", "fire", "red-dragon", (1020, 520, 1500, 960)),
)

REGION_CROPS = (
    ArtCrop("regions.png", "region", "forest", (25, 25, 615, 615)),
    ArtCrop("regions.png", "region", "plains", (640, 25, 1229, 615)),
    ArtCrop("regions.png", "region", "ruins", (25, 640, 615, 1229)),
    ArtCrop("regions.png", "region", "fire", (640, 640, 1229, 1229)),
)


def is_checkerboard(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) >= 215 and max(pixel) - min(pixel) <= 20


def remove_connected_checkerboard(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    candidate = bytearray(width * height)
    background = bytearray(width * height)
    queue: deque[int] = deque()

    for y in range(height):
        for x in range(width):
            candidate[y * width + x] = is_checkerboard(pixels[x, y])

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


def normalize(image: Image.Image, canvas_size: int, margin: int) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("The crop does not contain visible artwork")

    cropped = image.crop(bbox)
    available = canvas_size - margin * 2
    scale = min(available / cropped.width, available / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    result = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    result.alpha_composite(
        resized,
        ((canvas_size - resized.width) // 2, (canvas_size - resized.height) // 2),
    )
    return result


def render_entry(entry: ArtCrop, canvas_size: int, margin: int) -> Image.Image:
    source = Image.open(SOURCE_DIR / entry.source)
    return normalize(remove_connected_checkerboard(source.crop(entry.crop)), canvas_size, margin)


def save_contact_sheet(entries: list[tuple[str, Path]], tile_size: int = 180, columns: int = 6) -> None:
    rows = math.ceil(len(entries) / columns)
    label_height = 24
    sheet = Image.new("RGBA", (columns * tile_size, rows * (tile_size + label_height)), (10, 15, 23, 255))
    draw = ImageDraw.Draw(sheet)

    for index, (label, path) in enumerate(entries):
        image = Image.open(path).convert("RGBA")
        x = (index % columns) * tile_size
        y = (index // columns) * (tile_size + label_height)
        image.thumbnail((tile_size - 20, tile_size - 20), Image.Resampling.LANCZOS)
        sheet.alpha_composite(image, (x + (tile_size - image.width) // 2, y + (tile_size - image.height) // 2))
        draw.text((x + 8, y + tile_size), label, fill=(225, 232, 240, 255))

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def main() -> int:
    contact_entries: list[tuple[str, Path]] = []

    for entry in MONSTER_CROPS:
        target = MONSTER_DIR / entry.family / f"{entry.key}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        render_entry(entry, canvas_size=160, margin=12).save(target)
        contact_entries.append((f"{entry.family}/{entry.key}", target))

    for entry in REGION_CROPS:
        target = REGION_DIR / f"{entry.key}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        render_entry(entry, canvas_size=96, margin=4).save(target)
        contact_entries.append((f"region/{entry.key}", target))

    save_contact_sheet(contact_entries)
    print(f"monsters={len(MONSTER_CROPS)} regions={len(REGION_CROPS)}")
    print(f"contact_sheet={CONTACT_SHEET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
