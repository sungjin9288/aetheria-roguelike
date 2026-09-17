#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CATALOG_SCRIPT = ROOT / "scripts" / "monsterArtCatalog.mjs"
SOURCE_ROOT = ROOT / "public" / "assets" / "monsters"
OUTLINE = (42, 31, 46, 255)

PROTOTYPES = {
    "slime": ("forest/slime.png", "plains/green-slime.png", "forest/poison-mushroom.png"),
    "fungus": ("forest/poison-mushroom.png",),
    "beast": ("forest/wolf.png", "plains/boar.png", "plains/wild-dog.png", "fire/fire-lizard.png"),
    "aquatic": ("forest/forest-spirit.png", "fire/fire-spirit.png", "fire/fire-lizard.png"),
    "avian": ("fire/fire-bat.png", "fire/red-dragon.png"),
    "reptile": ("fire/fire-lizard.png", "plains/boar.png"),
    "dragon": ("fire/red-dragon.png", "fire/fire-lizard.png", "fire/fire-bat.png"),
    "construct": ("ruins/stone-guardian.png", "fire/lava-golem.png"),
    "machine": ("ruins/stone-guardian.png", "fire/lava-golem.png"),
    "undead": ("ruins/skeleton-soldier.png", "ruins/ghost-knight.png", "ruins/ruins-ghoul.png"),
    "spectral": ("ruins/ghost-knight.png", "forest/forest-spirit.png", "ruins/ruins-ghoul.png"),
    "insect": ("forest/spider-swarm.png", "forest/stag-beetle.png"),
    "spirit": ("forest/forest-spirit.png", "forest/forest-fairy.png", "fire/fire-spirit.png"),
    "aberration": ("forest/forest-spirit.png", "ruins/ghost-knight.png", "fire/fire-spirit.png"),
    "divine": ("forest/forest-fairy.png", "fire/fire-lord.png", "forest/forest-spirit.png"),
    "demon": ("fire/fire-lord.png", "fire/red-dragon.png", "ruins/ghost-knight.png"),
    "caster": ("fire/fire-lord.png", "forest/forest-fairy.png", "ruins/goblin.png"),
    "warrior": ("plains/plains-bandit.png", "ruins/ghost-knight.png", "ruins/skeleton-soldier.png"),
    "rogue": ("plains/plains-bandit.png", "plains/kobold.png", "ruins/goblin.png"),
    "humanoid": ("plains/plains-bandit.png", "plains/kobold.png", "ruins/goblin.png", "fire/fire-lord.png"),
}

ELEMENT_COLORS = {
    "화염": (245, 112, 64),
    "냉기": (92, 201, 238),
    "대지": (184, 137, 83),
    "바람": (117, 214, 151),
    "빛": (246, 220, 139),
    "어둠": (153, 105, 211),
    "에테르": (106, 214, 223),
    "자연": (104, 185, 102),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build deterministic exact art for the canonical monster catalog.")
    parser.add_argument("--output-root", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--contact-sheet-output", type=Path)
    return parser.parse_args()


def load_catalog() -> dict:
    result = subprocess.run(
        ["node", "--import", "tsx", str(CATALOG_SCRIPT), "--stdout"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def digest(text: str) -> bytes:
    return hashlib.sha256(text.encode("utf-8")).digest()


def accent_for(monster: dict, seed: bytes) -> tuple[int, int, int]:
    element = monster["weakness"] or monster["resistance"]
    base = ELEMENT_COLORS.get(element)
    if base:
        return tuple(max(48, min(245, channel + seed[index] % 35 - 17)) for index, channel in enumerate(base))
    return tuple(80 + seed[index] % 150 for index in range(3))


def choose_prototype(monster: dict, seed: bytes) -> str:
    name = monster["name"]
    exact_hints = (
        (("슬라임",), "forest/slime.png"),
        (("버섯",), "forest/poison-mushroom.png"),
        (("드래곤", "와이번", "비룡", "드레이크"), "fire/red-dragon.png"),
        (("박쥐",), "fire/fire-bat.png"),
        (("골렘", "석상", "수호신상", "거인"), "ruins/stone-guardian.png"),
        (("늑대",), "forest/wolf.png"),
        (("멧돼지",), "plains/boar.png"),
        (("들개",), "plains/wild-dog.png"),
        (("거미",), "forest/spider-swarm.png"),
        (("사슴벌레",), "forest/stag-beetle.png"),
        (("해골",), "ruins/skeleton-soldier.png"),
        (("유령", "망령"), "ruins/ghost-knight.png"),
        (("구울",), "ruins/ruins-ghoul.png"),
        (("정령", "영혼", "원소", "파편체", "수정체"), "forest/forest-spirit.png"),
        (("요정", "님프"), "forest/forest-fairy.png"),
        (("기사", "장군", "사령관", "용사"), "ruins/ghost-knight.png"),
        (("마법사", "마녀", "마구스", "사제", "제관", "기도사", "위치"), "fire/fire-lord.png"),
        (("마왕", "군주", "황제"), "fire/fire-lord.png"),
    )
    for hints, prototype in exact_hints:
        if any(hint in name for hint in hints):
            return prototype
    options = PROTOTYPES[monster["archetype"]]
    return options[seed[0] % len(options)]


def tint_sprite(source: Image.Image, accent: tuple[int, int, int], seed: bytes) -> Image.Image:
    image = source.convert("RGBA")
    pixels = list(image.get_flattened_data())
    amount = 0.18 + (seed[1] % 18) / 100
    tinted = []
    for red, green, blue, alpha in pixels:
        if alpha == 0 or max(red, green, blue) < 46:
            tinted.append((red, green, blue, alpha))
            continue
        luminance = (red * 3 + green * 6 + blue) / 10
        strength = amount * (0.72 if luminance > 188 else 1.0)
        tinted.append((
            round(red * (1 - strength) + accent[0] * strength),
            round(green * (1 - strength) + accent[1] * strength),
            round(blue * (1 - strength) + accent[2] * strength),
            alpha,
        ))
    image.putdata(tinted)
    image = ImageEnhance.Contrast(image).enhance(1.04)
    return image


def add_background_marks(canvas: Image.Image, monster: dict, accent: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    bright = tuple(min(255, channel + 48) for channel in accent) + (230,)
    muted = accent + (150,)

    if monster["isBoss"]:
        for offset in (0, 4, 8):
            box = (12 + offset, 12 + offset, 147 - offset, 147 - offset)
            draw.arc(box, 202, 254, fill=muted, width=2)
            draw.arc(box, 22, 74, fill=muted, width=2)
    if monster["archetype"] in {"aberration", "spectral"}:
        draw.ellipse((24, 29, 136, 141), outline=muted, width=2)
        draw.arc((11, 49, 149, 129), 190, 350, fill=bright, width=2)


def draw_staff(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], seed: bytes) -> None:
    bright = tuple(min(255, channel + 58) for channel in accent) + (255,)
    x = 126 if seed[12] % 2 else 31
    draw.line((x, 55, x, 135), fill=OUTLINE, width=7)
    draw.line((x, 55, x, 135), fill=bright, width=3)
    draw.ellipse((x - 8, 42, x + 8, 58), fill=accent + (225,), outline=OUTLINE, width=3)


def draw_weapon(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], seed: bytes) -> None:
    right_side = seed[12] % 2 == 0
    start_x, end_x = (119, 143) if right_side else (41, 17)
    draw.line((start_x, 94, end_x, 39), fill=OUTLINE, width=8)
    draw.line((start_x, 94, end_x, 39), fill=(224, 232, 236, 255), width=4)
    draw.polygon(
        [(end_x, 32), (end_x - (7 if right_side else -7), 45), (end_x + (5 if right_side else -5), 43)],
        fill=accent + (255,),
        outline=OUTLINE,
    )


def draw_wings(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    wing = accent + (200,)
    draw.polygon([(53, 67), (21, 51), (31, 85), (12, 81), (47, 111)], fill=wing, outline=OUTLINE)
    draw.polygon([(107, 67), (139, 51), (129, 85), (148, 81), (113, 111)], fill=wing, outline=OUTLINE)


def draw_tentacles(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], seed: bytes) -> None:
    color = accent + (235,)
    for index, anchor in enumerate((52, 68, 86, 103)):
        sway = -13 if (seed[13] >> index) & 1 else 13
        draw.line((anchor, 107, anchor + sway, 143, anchor + sway * 2, 134), fill=OUTLINE, width=9)
        draw.line((anchor, 107, anchor + sway, 143, anchor + sway * 2, 134), fill=color, width=5)


def draw_machine_marks(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    metal = (167, 184, 193, 255)
    draw.rectangle((115, 63, 145, 75), fill=metal, outline=OUTLINE, width=3)
    draw.ellipse((21, 102, 51, 132), fill=accent + (225,), outline=OUTLINE, width=4)
    for angle in range(0, 360, 45):
        x = 36 + round(math.cos(math.radians(angle)) * 19)
        y = 117 + round(math.sin(math.radians(angle)) * 19)
        draw.rectangle((x - 3, y - 3, x + 3, y + 3), fill=metal, outline=OUTLINE)


def draw_aberration_marks(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    sclera = (227, 226, 244, 245)
    draw.ellipse((58, 58, 102, 88), fill=OUTLINE)
    draw.ellipse((63, 63, 97, 83), fill=sclera)
    draw.ellipse((75, 63, 88, 83), fill=accent + (255,))
    draw.ellipse((79, 68, 85, 78), fill=OUTLINE)
    for x, y in ((32, 38), (126, 45), (25, 116), (137, 109)):
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=accent + (215,), outline=OUTLINE)


def draw_divine_marks(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    light = tuple(min(255, channel + 72) for channel in accent) + (245,)
    draw.ellipse((55, 17, 105, 31), outline=OUTLINE, width=6)
    draw.ellipse((55, 17, 105, 31), outline=light, width=3)
    draw.line((80, 31, 80, 42), fill=light, width=3)


def draw_horns(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int]) -> None:
    draw.polygon([(59, 45), (42, 18), (68, 37)], fill=accent + (245,), outline=OUTLINE)
    draw.polygon([(101, 45), (118, 18), (92, 37)], fill=accent + (245,), outline=OUTLINE)


def draw_identity_marks(canvas: Image.Image, monster: dict, accent: tuple[int, int, int], seed: bytes) -> None:
    draw = ImageDraw.Draw(canvas)
    bright = tuple(min(255, channel + 48) for channel in accent) + (230,)
    muted = accent + (190,)
    archetype = monster["archetype"]
    name = monster["name"]

    if archetype == "aquatic":
        draw_tentacles(draw, accent, seed)
        draw.polygon([(46, 79), (22, 66), (31, 91)], fill=muted, outline=OUTLINE)
        draw.polygon([(114, 79), (138, 66), (129, 91)], fill=muted, outline=OUTLINE)
    elif archetype == "avian":
        draw_wings(draw, accent)
    elif archetype == "machine":
        draw_machine_marks(draw, accent)
    elif archetype == "aberration":
        draw_aberration_marks(draw, accent)
    elif archetype == "divine":
        draw_divine_marks(draw, accent)
    elif archetype == "demon":
        draw_horns(draw, accent)
    elif archetype == "caster":
        draw_staff(draw, accent, seed)
    elif archetype == "warrior":
        draw_weapon(draw, accent, seed)
    elif archetype == "rogue":
        draw.line((24, 109, 51, 82), fill=OUTLINE, width=7)
        draw.line((136, 109, 109, 82), fill=OUTLINE, width=7)
        draw.line((24, 109, 51, 82), fill=bright, width=3)
        draw.line((136, 109, 109, 82), fill=bright, width=3)

    if monster["isBoss"] or any(title in name for title in ("군주", "여왕", "황제", "마왕")):
        draw.polygon([(66, 24), (72, 12), (80, 22), (89, 11), (96, 25)], fill=accent + (235,), outline=OUTLINE)
        draw.line([(68, 25), (94, 25)], fill=bright, width=3)

    if "꽃" in name or "봄" in name:
        for x, y in ((34, 36), (128, 45), (25, 122)):
            draw.ellipse((x - 5, y - 2, x + 5, y + 2), fill=bright)
            draw.ellipse((x - 2, y - 5, x + 2, y + 5), fill=bright)
    if "눈" in name and archetype != "aberration":
        draw_aberration_marks(draw, accent)

    for index in range(4):
        bit = (seed[3] >> index) & 1
        x = 119 + index * 7
        y = 132 - (seed[4 + index] % 3) * 4
        if bit:
            draw.polygon([(x, y - 3), (x + 3, y), (x, y + 3), (x - 3, y)], fill=bright)
        else:
            draw.rectangle((x - 2, y - 2, x + 2, y + 2), fill=muted)


def render_monster(monster: dict) -> tuple[Image.Image, str]:
    seed = digest(monster["name"])
    prototype = choose_prototype(monster, seed)
    accent = accent_for(monster, seed)
    sprite = tint_sprite(Image.open(SOURCE_ROOT / prototype), accent, seed)
    if seed[8] % 2:
        sprite = ImageOps.mirror(sprite)

    scale = 0.88 + (seed[9] % 10) / 100
    size = round(160 * scale)
    sprite = sprite.resize((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    add_background_marks(canvas, monster, accent)
    x = (160 - size) // 2 + (seed[10] % 5 - 2)
    y = (160 - size) // 2 + (seed[11] % 5 - 2)
    canvas.alpha_composite(sprite, (x, y))
    draw_identity_marks(canvas, monster, accent, seed)
    return canvas, f"/assets/monsters/{prototype}"


def save_contact_sheet(images: list[tuple[dict, Image.Image]], output: Path) -> None:
    columns = 10
    tile_width = 128
    tile_height = 148
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_width, rows * tile_height), (7, 11, 18, 255))
    font_path = Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")
    font = ImageFont.truetype(str(font_path), 12) if font_path.exists() else ImageFont.load_default()
    for index, (monster, image) in enumerate(images):
        preview = image.resize((112, 112), Image.Resampling.NEAREST)
        x = (index % columns) * tile_width + 8
        y = (index // columns) * tile_height + 4
        sheet.alpha_composite(preview, (x, y))
        label = monster["name"]
        if len(label) > 11:
            label = f"{label[:10]}…"
        ImageDraw.Draw(sheet).text(
            (x + 56, y + 116),
            label,
            font=font,
            anchor="ma",
            fill=(225, 231, 238, 255),
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", compress_level=9, optimize=False)


def publish_directory(staged: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    backup = target.with_name(f".{target.name}.{os.getpid()}.backup")
    if target.exists():
        os.replace(target, backup)
    try:
        os.replace(staged, target)
    except Exception:
        if backup.exists():
            os.replace(backup, target)
        raise
    if backup.exists():
        shutil.rmtree(backup)


def main() -> int:
    args = parse_args()
    catalog = load_catalog()
    final_directory = args.output_root / "assets" / "monsters" / "catalog"
    final_directory.parent.mkdir(parents=True, exist_ok=True)
    staged_directory = Path(tempfile.mkdtemp(prefix=".monster-catalog.", dir=final_directory.parent))
    entries = {}
    contact_images = []

    try:
        for monster in catalog["monsters"]:
            filename = f'{monster["key"]}.png'
            staged_path = staged_directory / filename
            correction = catalog["corrections"].get(monster["name"])
            if correction:
                source_runtime_path = correction["sourceRuntimePath"]
                source_path = ROOT / "public" / source_runtime_path.lstrip("/")
                shutil.copyfile(source_path, staged_path)
                if hashlib.sha256(staged_path.read_bytes()).hexdigest() != correction["sha256"]:
                    raise ValueError(f'Authored monster art changed during export: {monster["name"]}')
                image = Image.open(staged_path).convert("RGBA")
            else:
                image, source_runtime_path = render_monster(monster)
                image.save(staged_path, format="PNG", compress_level=9, optimize=False)
            bytes_value = staged_path.read_bytes()
            entries[monster["name"]] = {
                "key": monster["key"],
                "runtimePath": f'/assets/monsters/catalog/{filename}',
                "regionKey": monster["regionKey"],
                "archetype": monster["archetype"],
                "isBoss": monster["isBoss"],
                "sourceRuntimePath": source_runtime_path,
                "sha256": hashlib.sha256(bytes_value).hexdigest(),
            }
            contact_images.append((monster, image))

        manifest = {
            "version": 1,
            "catalogSha256": catalog["catalogSha256"],
            "art": {
                "width": 160,
                "height": 160,
                "margin": 8,
                "assetRoot": "/assets/monsters/catalog/",
                "styleVersion": 2,
            },
            "entries": entries,
        }
        args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
        staged_manifest = args.manifest_output.with_name(f".{args.manifest_output.name}.{os.getpid()}.stage")
        staged_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        publish_directory(staged_directory, final_directory)
        os.replace(staged_manifest, args.manifest_output)
        if args.contact_sheet_output:
            save_contact_sheet(contact_images, args.contact_sheet_output)
    finally:
        if staged_directory.exists():
            shutil.rmtree(staged_directory)

    print(f'monsters={len(entries)} catalogSha256={catalog["catalogSha256"]}')
    print(f'output={final_directory}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
