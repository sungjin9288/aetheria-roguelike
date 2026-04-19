"""Tier S 시그니처 sprite 생성기.

SIGNATURE_CANDIDATES 상위 5개(Tier S)에 대해 family 공용 PNG와 실루엣/액센트가
확연히 다른 고유 pixel art를 생성한다.

- Item view (160×160): /assets/equipment-exact/signature-{slug}.png
- Wearable overlay (72×72): /assets/equipment-wearable-exact/signature-{slug}.png

파이프라인은 artPalette.json을 단일 소스로 읽는다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parent.parent
ITEM_OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
WEARABLE_OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-wearable-exact"
ARTIFACT_DIR = REPO_ROOT / "output" / "imagegen" / "signature-sprites"
PALETTE_JSON = REPO_ROOT / "src" / "data" / "artPalette.json"

ITEM_CANVAS = (160, 160)
WEARABLE_CANVAS = (72, 72)


def _hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    clean = hex_color.lstrip("#")
    return (
        int(clean[0:2], 16),
        int(clean[2:4], 16),
        int(clean[4:6], 16),
        alpha,
    )


def load_palette() -> dict[str, dict[str, tuple[int, int, int, int]]]:
    raw = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    tones = raw["tonePalettes"]
    return {
        key: {field: _hex_to_rgba(tone[field]) for field in ("outline", "shade", "mid", "hi", "trim")}
        for key, tone in tones.items()
    }


@dataclass(frozen=True)
class Signature:
    slug: str
    item_name: str
    tone_key: str
    family: str  # 'weapon' | 'shield' | 'armor'
    item_painter: Callable[[ImageDraw.ImageDraw, dict, int, int], None]
    wearable_painter: Callable[[ImageDraw.ImageDraw, dict, int, int], None]


# ───────────────────────────────────────────────────────────────────────
# 공통 드로잉 헬퍼
# ───────────────────────────────────────────────────────────────────────

def poly(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color, ox: int, oy: int, scale: int) -> None:
    draw.polygon([(ox + x * scale, oy + y * scale) for x, y in points], fill=color)


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color, ox: int, oy: int, scale: int) -> None:
    draw.rectangle(
        (ox + x * scale, oy + y * scale, ox + (x + w) * scale - 1, oy + (y + h) * scale - 1),
        fill=color,
    )


def dot(draw: ImageDraw.ImageDraw, x: int, y: int, color, ox: int, oy: int, scale: int) -> None:
    rect(draw, x, y, 1, 1, color, ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# 1. 성검 에테르니아 — 빛 속성 1H, 황금 십자가드 + 성광 블레이드
# ───────────────────────────────────────────────────────────────────────
def paint_ethernia_item(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 4) -> None:
    # blade (세로 길쭉한 흰 빛 검)
    poly(draw, [(11, 1), (13, 3), (13, 18), (11, 20), (9, 18), (9, 3)], p["outline"], ox, oy, scale)
    poly(draw, [(10, 3), (12, 4), (12, 17), (10, 19), (10, 4)], p["shade"], ox, oy, scale)
    rect(draw, 10, 4, 2, 13, p["hi"], ox, oy, scale)
    # crossguard (황금)
    rect(draw, 5, 19, 13, 2, p["outline"], ox, oy, scale)
    rect(draw, 6, 20, 11, 1, p["trim"], ox, oy, scale)
    # winged crossguard tips
    rect(draw, 4, 20, 1, 1, p["trim"], ox, oy, scale)
    rect(draw, 18, 20, 1, 1, p["trim"], ox, oy, scale)
    # grip
    rect(draw, 10, 21, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 11, 22, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    # pommel jewel
    rect(draw, 10, 27, 3, 2, p["outline"], ox, oy, scale)
    rect(draw, 11, 28, 1, 1, p["trim"], ox, oy, scale)
    # rim light
    dot(draw, 10, 5, p["hi"], ox, oy, scale)
    dot(draw, 10, 10, p["hi"], ox, oy, scale)


def paint_ethernia_wearable(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 2) -> None:
    # compact version at 72×72
    poly(draw, [(13, 1), (15, 3), (15, 20), (13, 22), (11, 20), (11, 3)], p["outline"], ox, oy, scale)
    poly(draw, [(12, 3), (14, 4), (14, 19), (12, 21), (12, 4)], p["shade"], ox, oy, scale)
    rect(draw, 12, 5, 2, 14, p["hi"], ox, oy, scale)
    rect(draw, 7, 21, 13, 2, p["outline"], ox, oy, scale)
    rect(draw, 8, 22, 11, 1, p["trim"], ox, oy, scale)
    rect(draw, 12, 23, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 13, 24, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    rect(draw, 12, 29, 3, 2, p["outline"], ox, oy, scale)
    dot(draw, 13, 30, p["trim"], ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# 2. 마왕의 대낫 — 어둠 2H scythe, 거대한 곡선 날
# ───────────────────────────────────────────────────────────────────────
def paint_demon_scythe_item(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 4) -> None:
    # shaft
    rect(draw, 11, 6, 3, 22, p["outline"], ox, oy, scale)
    rect(draw, 12, 7, 1, 20, p["shade"], ox, oy, scale)
    # scythe blade — inward-curving from top
    poly(draw, [(14, 2), (22, 3), (24, 9), (20, 11), (16, 9), (14, 6)], p["outline"], ox, oy, scale)
    poly(draw, [(15, 3), (21, 4), (22, 8), (19, 10), (16, 8), (15, 6)], p["shade"], ox, oy, scale)
    poly(draw, [(16, 4), (20, 5), (20, 7), (18, 8), (17, 6)], p["mid"], ox, oy, scale)
    # blade cusp (어둠 hi tint)
    dot(draw, 20, 5, p["hi"], ox, oy, scale)
    # pommel spike (사용자 잡는 쪽 끝)
    poly(draw, [(11, 28), (14, 28), (12, 31)], p["outline"], ox, oy, scale)
    # grip band
    rect(draw, 11, 15, 3, 2, p["trim"], ox, oy, scale)


def paint_demon_scythe_wearable(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 2) -> None:
    rect(draw, 14, 6, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 15, 7, 1, 22, p["shade"], ox, oy, scale)
    poly(draw, [(17, 2), (26, 3), (27, 9), (22, 11), (18, 9), (17, 6)], p["outline"], ox, oy, scale)
    poly(draw, [(18, 3), (25, 4), (25, 8), (21, 10), (18, 7)], p["shade"], ox, oy, scale)
    poly(draw, [(19, 4), (23, 5), (23, 7), (21, 8)], p["mid"], ox, oy, scale)
    dot(draw, 23, 5, p["hi"], ox, oy, scale)
    rect(draw, 14, 16, 3, 2, p["trim"], ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# 3. 라그나로크 — 화염 2H greatsword, 넓은 불꽃 블레이드 + 재질 아이콘
# ───────────────────────────────────────────────────────────────────────
def paint_ragnarok_item(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 4) -> None:
    # flame-tinted blade (wide)
    poly(draw, [(10, 1), (15, 4), (15, 17), (10, 19), (6, 17), (6, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 4), (10, 3), (14, 4), (14, 16), (10, 18), (7, 16)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 5), (13, 5), (13, 15), (10, 17), (8, 15)], p["mid"], ox, oy, scale)
    # central fire channel
    rect(draw, 10, 5, 1, 12, p["hi"], ox, oy, scale)
    rect(draw, 10, 8, 2, 2, p["trim"], ox, oy, scale)
    # flared crossguard
    poly(draw, [(3, 18), (17, 18), (18, 22), (2, 22)], p["outline"], ox, oy, scale)
    poly(draw, [(4, 19), (16, 19), (17, 21), (3, 21)], p["shade"], ox, oy, scale)
    rect(draw, 8, 19, 4, 2, p["trim"], ox, oy, scale)
    # grip
    rect(draw, 9, 22, 4, 7, p["outline"], ox, oy, scale)
    rect(draw, 10, 23, 2, 5, (113, 72, 38, 255), ox, oy, scale)
    rect(draw, 9, 29, 4, 2, p["trim"], ox, oy, scale)


def paint_ragnarok_wearable(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 2) -> None:
    poly(draw, [(12, 1), (18, 4), (18, 18), (12, 20), (6, 18), (6, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 4), (12, 3), (16, 4), (16, 17), (12, 19), (8, 17)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 5), (14, 5), (14, 16), (12, 18), (10, 16)], p["mid"], ox, oy, scale)
    rect(draw, 12, 5, 1, 13, p["hi"], ox, oy, scale)
    rect(draw, 12, 9, 2, 2, p["trim"], ox, oy, scale)
    poly(draw, [(2, 19), (22, 19), (23, 22), (1, 22)], p["outline"], ox, oy, scale)
    rect(draw, 10, 20, 4, 2, p["trim"], ox, oy, scale)
    rect(draw, 11, 22, 3, 7, p["outline"], ox, oy, scale)
    rect(draw, 12, 23, 1, 5, (113, 72, 38, 255), ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# 4. 차원 마왕의 낫 — 어둠 2H, 차원 균열 이중 날
# ───────────────────────────────────────────────────────────────────────
def paint_dimension_scythe_item(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 4) -> None:
    # long shaft
    rect(draw, 11, 5, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 12, 6, 1, 22, p["shade"], ox, oy, scale)
    # upper blade (mirror of demon scythe but larger)
    poly(draw, [(14, 1), (24, 2), (26, 7), (20, 10), (16, 8), (14, 5)], p["outline"], ox, oy, scale)
    poly(draw, [(15, 2), (22, 3), (23, 6), (19, 9), (16, 7), (15, 5)], p["shade"], ox, oy, scale)
    poly(draw, [(16, 3), (21, 4), (21, 6), (19, 7)], p["mid"], ox, oy, scale)
    # lower secondary blade (차원 균열)
    poly(draw, [(13, 12), (6, 15), (4, 18), (10, 17), (13, 14)], p["outline"], ox, oy, scale)
    poly(draw, [(13, 13), (7, 15), (6, 17), (10, 16), (13, 14)], p["shade"], ox, oy, scale)
    # rift glow (violet hi)
    dot(draw, 21, 5, p["hi"], ox, oy, scale)
    dot(draw, 7, 16, p["hi"], ox, oy, scale)
    # grip band
    rect(draw, 11, 19, 3, 2, p["trim"], ox, oy, scale)


def paint_dimension_scythe_wearable(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 2) -> None:
    rect(draw, 14, 5, 3, 26, p["outline"], ox, oy, scale)
    rect(draw, 15, 6, 1, 24, p["shade"], ox, oy, scale)
    poly(draw, [(17, 1), (28, 2), (30, 7), (23, 10), (18, 8), (17, 5)], p["outline"], ox, oy, scale)
    poly(draw, [(18, 2), (26, 3), (27, 6), (22, 9), (18, 6)], p["shade"], ox, oy, scale)
    poly(draw, [(19, 3), (24, 4), (24, 6), (22, 7)], p["mid"], ox, oy, scale)
    poly(draw, [(16, 14), (7, 17), (5, 20), (12, 19), (16, 16)], p["outline"], ox, oy, scale)
    dot(draw, 25, 5, p["hi"], ox, oy, scale)
    dot(draw, 8, 18, p["hi"], ox, oy, scale)
    rect(draw, 14, 20, 3, 2, p["trim"], ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# 5. 천공 성전 — 빛 focus shield, 육각 성서 엠블럼
# ───────────────────────────────────────────────────────────────────────
def paint_celestial_tome_item(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 4) -> None:
    # tome cover (hex-ish shield shape)
    poly(draw, [(5, 5), (11, 3), (17, 3), (23, 5), (23, 22), (17, 26), (11, 26), (5, 22)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 6), (11, 4), (17, 4), (22, 6), (22, 21), (17, 25), (11, 25), (6, 21)], p["shade"], ox, oy, scale)
    poly(draw, [(8, 8), (12, 6), (16, 6), (20, 8), (20, 20), (16, 23), (12, 23), (8, 20)], p["mid"], ox, oy, scale)
    # central cross (holy trim)
    rect(draw, 13, 9, 2, 13, p["trim"], ox, oy, scale)
    rect(draw, 10, 14, 8, 2, p["trim"], ox, oy, scale)
    # top jewel
    rect(draw, 13, 4, 2, 2, p["hi"], ox, oy, scale)
    # corner rivets
    dot(draw, 7, 7, p["hi"], ox, oy, scale)
    dot(draw, 21, 7, p["hi"], ox, oy, scale)
    dot(draw, 7, 20, p["hi"], ox, oy, scale)
    dot(draw, 21, 20, p["hi"], ox, oy, scale)


def paint_celestial_tome_wearable(draw: ImageDraw.ImageDraw, p: dict, ox: int, oy: int, scale: int = 2) -> None:
    poly(draw, [(6, 6), (12, 4), (20, 4), (26, 6), (26, 24), (20, 28), (12, 28), (6, 24)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 7), (12, 5), (20, 5), (25, 7), (25, 23), (20, 27), (12, 27), (7, 23)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 9), (13, 7), (19, 7), (23, 9), (23, 21), (19, 25), (13, 25), (9, 21)], p["mid"], ox, oy, scale)
    rect(draw, 15, 10, 2, 14, p["trim"], ox, oy, scale)
    rect(draw, 10, 15, 12, 2, p["trim"], ox, oy, scale)
    rect(draw, 15, 5, 2, 2, p["hi"], ox, oy, scale)


SIGNATURES: tuple[Signature, ...] = (
    Signature(
        slug="signature-weapon-ethernia",
        item_name="성검 에테르니아",
        tone_key="holy",
        family="weapon",
        item_painter=paint_ethernia_item,
        wearable_painter=paint_ethernia_wearable,
    ),
    Signature(
        slug="signature-weapon-demon-scythe",
        item_name="마왕의 대낫",
        tone_key="shadow",
        family="weapon",
        item_painter=paint_demon_scythe_item,
        wearable_painter=paint_demon_scythe_wearable,
    ),
    Signature(
        slug="signature-weapon-ragnarok",
        item_name="라그나로크",
        tone_key="fire",
        family="weapon",
        item_painter=paint_ragnarok_item,
        wearable_painter=paint_ragnarok_wearable,
    ),
    Signature(
        slug="signature-weapon-dimension-scythe",
        item_name="차원 마왕의 낫",
        tone_key="shadow",
        family="weapon",
        item_painter=paint_dimension_scythe_item,
        wearable_painter=paint_dimension_scythe_wearable,
    ),
    Signature(
        slug="signature-shield-celestial-tome",
        item_name="천공 성전",
        tone_key="holy",
        family="shield",
        item_painter=paint_celestial_tome_item,
        wearable_painter=paint_celestial_tome_wearable,
    ),
)


def build_item_sprite(sig: Signature, palettes: dict) -> Image.Image:
    img = Image.new("RGBA", ITEM_CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # item canvas: scale 4, center recipes (recipes designed on ~32×32 grid)
    scale = 4
    grid_side = 32
    ox = (ITEM_CANVAS[0] - grid_side * scale) // 2
    oy = (ITEM_CANVAS[1] - grid_side * scale) // 2
    sig.item_painter(draw, palettes[sig.tone_key], ox, oy, scale)
    return img


def build_wearable_sprite(sig: Signature, palettes: dict) -> Image.Image:
    img = Image.new("RGBA", WEARABLE_CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = 2
    grid_side = 32
    ox = (WEARABLE_CANVAS[0] - grid_side * scale) // 2
    oy = (WEARABLE_CANVAS[1] - grid_side * scale) // 2
    sig.wearable_painter(draw, palettes[sig.tone_key], ox, oy, scale)
    return img


def save_contact_sheet(images: dict[str, Image.Image], out_path: Path, tile_size: tuple[int, int]) -> None:
    columns = 3
    tile_w, tile_h = tile_size
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_w, rows * tile_h), (7, 11, 16, 255))
    for index, (key, image) in enumerate(images.items()):
        col = index % columns
        row = index // columns
        x = col * tile_w
        y = row * tile_h
        tile = Image.new("RGBA", (tile_w, tile_h), (14, 19, 27, 255))
        px = (tile_w - image.width) // 2
        py = (tile_h - 24 - image.height) // 2 + 8
        tile.alpha_composite(image, (px, py))
        tile_draw = ImageDraw.Draw(tile)
        tile_draw.text((8, tile_h - 18), key, fill=(226, 232, 240, 255))
        sheet.alpha_composite(tile, (x, y))
    sheet.save(out_path)


def main() -> None:
    ITEM_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WEARABLE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    palettes = load_palette()

    item_images: dict[str, Image.Image] = {}
    wearable_images: dict[str, Image.Image] = {}

    for sig in SIGNATURES:
        item_image = build_item_sprite(sig, palettes)
        wearable_image = build_wearable_sprite(sig, palettes)
        item_image.save(ITEM_OUTPUT_DIR / f"{sig.slug}.png")
        wearable_image.save(WEARABLE_OUTPUT_DIR / f"{sig.slug}.png")
        item_images[sig.slug] = item_image
        wearable_images[sig.slug] = wearable_image

    save_contact_sheet(item_images, ARTIFACT_DIR / "items-contact-sheet.png", (200, 200))
    save_contact_sheet(wearable_images, ARTIFACT_DIR / "wearables-contact-sheet.png", (120, 120))

    manifest = {
        "signatures": [
            {"slug": sig.slug, "itemName": sig.item_name, "toneKey": sig.tone_key, "family": sig.family}
            for sig in SIGNATURES
        ],
    }
    (ARTIFACT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
