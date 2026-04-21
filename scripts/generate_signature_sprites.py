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


# ───────────────────────────────────────────────────────────────────────
# Tier A (10종) — 주요 보스 드롭 / 세트 핵심
# ───────────────────────────────────────────────────────────────────────

# 6. 드래곤로드 갑주 — 붉은 용비늘 플레이트, 뿔 숄더
def paint_dragon_lord_armor_item(draw, p, ox, oy, scale=4):
    # shoulders with horn tips
    poly(draw, [(3, 8), (7, 6), (10, 8), (3, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(18, 8), (22, 6), (25, 8), (25, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(4, 9), (7, 7), (9, 9), (4, 10)], p["shade"], ox, oy, scale)
    poly(draw, [(19, 9), (22, 7), (24, 9), (24, 10)], p["shade"], ox, oy, scale)
    # main breastplate
    poly(draw, [(7, 9), (21, 9), (24, 12), (23, 24), (14, 28), (5, 24), (4, 12)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 10), (20, 10), (22, 12), (22, 23), (14, 27), (6, 23), (6, 12)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 12), (19, 12), (21, 14), (21, 22), (14, 25), (7, 22), (7, 14)], p["mid"], ox, oy, scale)
    # scale rows (용비늘 패턴)
    for y in (14, 17, 20):
        for x in (9, 12, 15, 18):
            dot(draw, x, y, p["hi"], ox, oy, scale)
    # central gem
    rect(draw, 13, 14, 2, 3, p["trim"], ox, oy, scale)


def paint_dragon_lord_armor_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(3, 6), (8, 4), (11, 6), (3, 10)], p["outline"], ox, oy, scale)
    poly(draw, [(20, 6), (25, 4), (29, 6), (29, 10)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 7), (26, 7), (28, 11), (27, 26), (16, 30), (4, 26), (4, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 8), (25, 8), (26, 11), (25, 25), (16, 28), (6, 25), (6, 11)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 11), (23, 11), (24, 14), (24, 23), (16, 26), (8, 23), (8, 14)], p["mid"], ox, oy, scale)
    for y in (13, 16, 19, 22):
        for x in (10, 14, 18, 22):
            dot(draw, x, y, p["hi"], ox, oy, scale)
    rect(draw, 15, 13, 2, 3, p["trim"], ox, oy, scale)


# 7. 암흑 군주의 망토 — 와이드 망토, 어둠 트림
def paint_dark_lord_cloak_item(draw, p, ox, oy, scale=4):
    # wide cloak silhouette (wider than family cloak)
    poly(draw, [(3, 4), (9, 2), (19, 2), (25, 4), (27, 10), (26, 25), (18, 29), (10, 29), (2, 25), (1, 10)], p["outline"], ox, oy, scale)
    poly(draw, [(4, 5), (10, 3), (18, 3), (24, 5), (25, 10), (24, 24), (17, 28), (11, 28), (3, 24), (3, 10)], p["shade"], ox, oy, scale)
    poly(draw, [(6, 7), (13, 6), (16, 6), (22, 7), (22, 10), (21, 22), (16, 26), (12, 26), (6, 22), (6, 10)], p["mid"], ox, oy, scale)
    # purple clasp (어둠 trim)
    rect(draw, 13, 4, 3, 3, p["trim"], ox, oy, scale)
    dot(draw, 14, 5, p["hi"], ox, oy, scale)
    # shadow tendrils (lower hem)
    rect(draw, 6, 27, 2, 2, p["outline"], ox, oy, scale)
    rect(draw, 11, 28, 2, 2, p["outline"], ox, oy, scale)
    rect(draw, 15, 28, 2, 2, p["outline"], ox, oy, scale)
    rect(draw, 19, 27, 2, 2, p["outline"], ox, oy, scale)


def paint_dark_lord_cloak_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(3, 4), (10, 2), (22, 2), (29, 4), (30, 9), (29, 26), (22, 30), (10, 30), (2, 26), (2, 9)], p["outline"], ox, oy, scale)
    poly(draw, [(4, 5), (11, 3), (21, 3), (28, 5), (28, 9), (27, 25), (21, 29), (11, 29), (4, 25), (4, 9)], p["shade"], ox, oy, scale)
    poly(draw, [(7, 7), (15, 6), (17, 6), (25, 7), (25, 10), (24, 23), (17, 26), (15, 26), (7, 23), (7, 10)], p["mid"], ox, oy, scale)
    rect(draw, 15, 4, 3, 3, p["trim"], ox, oy, scale)


# 8. 세계수의 지팡이 — 2H 자연 스태프, 가지 + 잎
def paint_worldtree_staff_item(draw, p, ox, oy, scale=4):
    # shaft
    rect(draw, 12, 8, 3, 22, p["outline"], ox, oy, scale)
    rect(draw, 13, 9, 1, 20, p["shade"], ox, oy, scale)
    # head — branching (실루엣이 nature)
    poly(draw, [(8, 2), (13, 0), (18, 2), (19, 7), (15, 9), (11, 9), (7, 7)], p["outline"], ox, oy, scale)
    poly(draw, [(9, 3), (13, 1), (17, 3), (18, 6), (14, 8), (12, 8), (8, 6)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 4), (13, 2), (16, 4), (16, 6), (13, 7), (11, 6)], p["mid"], ox, oy, scale)
    # leaves (side branches)
    poly(draw, [(4, 5), (8, 4), (7, 8), (3, 7)], p["mid"], ox, oy, scale)
    poly(draw, [(19, 5), (23, 4), (23, 7), (19, 8)], p["mid"], ox, oy, scale)
    poly(draw, [(5, 6), (7, 5), (6, 7)], p["hi"], ox, oy, scale)
    poly(draw, [(20, 6), (22, 5), (21, 7)], p["hi"], ox, oy, scale)
    # central crystal
    dot(draw, 13, 4, p["trim"], ox, oy, scale)


def paint_worldtree_staff_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 14, 8, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 15, 9, 1, 22, p["shade"], ox, oy, scale)
    poly(draw, [(9, 2), (15, 0), (21, 2), (22, 7), (17, 9), (13, 9), (8, 7)], p["outline"], ox, oy, scale)
    poly(draw, [(10, 3), (15, 1), (20, 3), (21, 6), (16, 8), (14, 8), (9, 6)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 4), (15, 2), (19, 4), (19, 6), (15, 7), (13, 6)], p["mid"], ox, oy, scale)
    poly(draw, [(4, 5), (9, 4), (8, 8), (3, 7)], p["mid"], ox, oy, scale)
    poly(draw, [(22, 5), (27, 4), (27, 7), (22, 8)], p["mid"], ox, oy, scale)
    dot(draw, 15, 4, p["trim"], ox, oy, scale)


# 9. 차원 방패 이지스 — 육각 타워 쉴드, 프리즘 균열
def paint_aegis_shield_item(draw, p, ox, oy, scale=4):
    # hexagonal tower shield
    poly(draw, [(5, 5), (14, 2), (23, 5), (23, 22), (14, 28), (5, 22)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 6), (14, 3), (22, 6), (22, 21), (14, 27), (6, 21)], p["shade"], ox, oy, scale)
    poly(draw, [(8, 8), (14, 5), (20, 8), (20, 20), (14, 25), (8, 20)], p["mid"], ox, oy, scale)
    # prism rift down center
    poly(draw, [(14, 6), (17, 12), (14, 24), (11, 12)], p["trim"], ox, oy, scale)
    poly(draw, [(14, 8), (16, 13), (14, 22), (12, 13)], p["hi"], ox, oy, scale)
    # corner rivets
    dot(draw, 7, 8, p["hi"], ox, oy, scale)
    dot(draw, 21, 8, p["hi"], ox, oy, scale)
    dot(draw, 7, 21, p["hi"], ox, oy, scale)
    dot(draw, 21, 21, p["hi"], ox, oy, scale)


def paint_aegis_shield_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(6, 5), (16, 2), (26, 5), (26, 24), (16, 30), (6, 24)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 6), (16, 3), (25, 6), (25, 23), (16, 29), (7, 23)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 8), (16, 5), (23, 8), (23, 22), (16, 27), (9, 22)], p["mid"], ox, oy, scale)
    poly(draw, [(16, 6), (19, 13), (16, 26), (13, 13)], p["trim"], ox, oy, scale)
    poly(draw, [(16, 8), (18, 14), (16, 24), (14, 14)], p["hi"], ox, oy, scale)


# 10. 에테르 그리모어 — 체인 + 룬 커버 그리모어
def paint_ether_grimoire_item(draw, p, ox, oy, scale=4):
    # thick book cover
    rect(draw, 5, 5, 18, 20, p["outline"], ox, oy, scale)
    rect(draw, 6, 6, 16, 18, p["shade"], ox, oy, scale)
    rect(draw, 8, 7, 12, 16, p["mid"], ox, oy, scale)
    # spine (중앙)
    rect(draw, 13, 4, 2, 22, p["outline"], ox, oy, scale)
    rect(draw, 13, 5, 2, 20, p["trim"], ox, oy, scale)
    # rune symbol on cover
    rect(draw, 9, 10, 1, 6, p["hi"], ox, oy, scale)
    rect(draw, 9, 12, 3, 1, p["hi"], ox, oy, scale)
    rect(draw, 16, 10, 3, 1, p["hi"], ox, oy, scale)
    rect(draw, 18, 10, 1, 6, p["hi"], ox, oy, scale)
    rect(draw, 16, 15, 3, 1, p["hi"], ox, oy, scale)
    # chain clasp (상단)
    rect(draw, 11, 3, 1, 3, p["outline"], ox, oy, scale)
    rect(draw, 16, 3, 1, 3, p["outline"], ox, oy, scale)
    dot(draw, 13, 22, p["trim"], ox, oy, scale)


def paint_ether_grimoire_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 6, 6, 20, 22, p["outline"], ox, oy, scale)
    rect(draw, 7, 7, 18, 20, p["shade"], ox, oy, scale)
    rect(draw, 9, 8, 14, 18, p["mid"], ox, oy, scale)
    rect(draw, 15, 5, 2, 25, p["outline"], ox, oy, scale)
    rect(draw, 15, 6, 2, 23, p["trim"], ox, oy, scale)
    rect(draw, 11, 12, 1, 7, p["hi"], ox, oy, scale)
    rect(draw, 20, 12, 1, 7, p["hi"], ox, oy, scale)


# 11. 천벌의 지팡이 — 빛 2H, 후광 십자가 상단
def paint_divine_wrath_staff_item(draw, p, ox, oy, scale=4):
    # shaft
    rect(draw, 12, 6, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 13, 7, 1, 22, p["shade"], ox, oy, scale)
    # cross head
    rect(draw, 10, 1, 7, 2, p["outline"], ox, oy, scale)
    rect(draw, 11, 1, 5, 1, p["trim"], ox, oy, scale)
    rect(draw, 12, 3, 3, 5, p["outline"], ox, oy, scale)
    rect(draw, 13, 4, 1, 3, p["trim"], ox, oy, scale)
    # halo ring
    poly(draw, [(8, 4), (19, 4), (19, 6), (8, 6)], p["hi"], ox, oy, scale)
    # grip band
    rect(draw, 12, 14, 3, 2, p["trim"], ox, oy, scale)


def paint_divine_wrath_staff_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 14, 5, 3, 26, p["outline"], ox, oy, scale)
    rect(draw, 15, 6, 1, 24, p["shade"], ox, oy, scale)
    rect(draw, 12, 1, 7, 2, p["outline"], ox, oy, scale)
    rect(draw, 13, 1, 5, 1, p["trim"], ox, oy, scale)
    rect(draw, 14, 3, 3, 5, p["outline"], ox, oy, scale)
    rect(draw, 15, 4, 1, 3, p["trim"], ox, oy, scale)
    poly(draw, [(9, 4), (22, 4), (22, 6), (9, 6)], p["hi"], ox, oy, scale)
    rect(draw, 14, 15, 3, 2, p["trim"], ox, oy, scale)


# 12. 빙결의 왕관검 — 냉기 1H, 크리스탈 블레이드 + 왕관 펌멜
def paint_frost_crown_sword_item(draw, p, ox, oy, scale=4):
    # crystalline blade (jagged edges)
    poly(draw, [(10, 2), (13, 0), (15, 3), (14, 7), (15, 11), (14, 15), (13, 18), (11, 19), (10, 15), (11, 11), (10, 7), (11, 3)], p["outline"], ox, oy, scale)
    poly(draw, [(11, 3), (13, 2), (13, 6), (12, 10), (13, 14), (12, 17)], p["shade"], ox, oy, scale)
    rect(draw, 12, 4, 1, 13, p["hi"], ox, oy, scale)
    # crossguard
    rect(draw, 7, 19, 11, 2, p["outline"], ox, oy, scale)
    rect(draw, 8, 19, 9, 1, p["trim"], ox, oy, scale)
    # grip
    rect(draw, 11, 21, 3, 5, p["outline"], ox, oy, scale)
    rect(draw, 12, 22, 1, 3, (113, 72, 38, 255), ox, oy, scale)
    # crown pommel (5 spikes)
    poly(draw, [(9, 26), (11, 28), (13, 26), (13, 28), (15, 26), (15, 28), (11, 29)], p["outline"], ox, oy, scale)
    rect(draw, 11, 27, 3, 1, p["trim"], ox, oy, scale)


def paint_frost_crown_sword_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(13, 2), (16, 0), (18, 3), (17, 7), (18, 12), (17, 17), (15, 20), (13, 20), (13, 17), (14, 12), (13, 7)], p["outline"], ox, oy, scale)
    rect(draw, 15, 4, 1, 14, p["hi"], ox, oy, scale)
    rect(draw, 9, 20, 13, 2, p["outline"], ox, oy, scale)
    rect(draw, 10, 20, 11, 1, p["trim"], ox, oy, scale)
    rect(draw, 14, 22, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 15, 23, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    poly(draw, [(12, 28), (14, 30), (16, 28), (18, 30), (20, 28), (14, 31)], p["outline"], ox, oy, scale)


# 13. 바람의 궁극 — 2H longbow, 바람 깃털
def paint_wind_ultimate_bow_item(draw, p, ox, oy, scale=4):
    # recurve bow
    poly(draw, [(8, 1), (12, 3), (14, 8), (14, 18), (12, 23), (8, 25), (10, 22), (11, 18), (11, 8), (10, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(18, 1), (14, 3), (12, 8), (12, 18), (14, 23), (18, 25), (16, 22), (15, 18), (15, 8), (16, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(9, 3), (11, 5), (12, 9), (12, 17), (11, 21), (9, 23)], p["shade"], ox, oy, scale)
    poly(draw, [(17, 3), (15, 5), (14, 9), (14, 17), (15, 21), (17, 23)], p["shade"], ox, oy, scale)
    # bowstring
    rect(draw, 13, 3, 1, 20, p["hi"], ox, oy, scale)
    # wind feathers (sides)
    poly(draw, [(4, 10), (7, 12), (4, 14)], p["mid"], ox, oy, scale)
    poly(draw, [(19, 12), (22, 10), (22, 14)], p["mid"], ox, oy, scale)
    poly(draw, [(5, 11), (6, 13)], p["hi"], ox, oy, scale)


def paint_wind_ultimate_bow_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(8, 1), (13, 3), (15, 9), (15, 22), (13, 28), (8, 30), (11, 25), (12, 18), (12, 10), (11, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(22, 1), (17, 3), (15, 9), (15, 22), (17, 28), (22, 30), (19, 25), (18, 18), (18, 10), (19, 4)], p["outline"], ox, oy, scale)
    rect(draw, 15, 3, 1, 25, p["hi"], ox, oy, scale)
    poly(draw, [(3, 14), (7, 16), (3, 18)], p["mid"], ox, oy, scale)
    poly(draw, [(23, 16), (27, 14), (27, 18)], p["mid"], ox, oy, scale)


# 14. 그림자 절단기 — 어둠 1H, 곡선 블레이드
def paint_shadow_cutter_item(draw, p, ox, oy, scale=4):
    # curved falchion-like blade with shadow edge
    poly(draw, [(10, 2), (16, 5), (18, 11), (17, 16), (14, 19), (11, 18), (11, 12), (10, 6)], p["outline"], ox, oy, scale)
    poly(draw, [(11, 4), (14, 6), (16, 11), (15, 15), (13, 17), (12, 13)], p["shade"], ox, oy, scale)
    poly(draw, [(12, 6), (14, 9), (14, 13), (13, 15)], p["mid"], ox, oy, scale)
    # shadow rim (trim = purple)
    dot(draw, 15, 9, p["trim"], ox, oy, scale)
    dot(draw, 16, 13, p["trim"], ox, oy, scale)
    # crossguard (angular)
    poly(draw, [(6, 18), (14, 17), (16, 20), (5, 20)], p["outline"], ox, oy, scale)
    rect(draw, 8, 18, 6, 1, p["trim"], ox, oy, scale)
    # grip
    rect(draw, 10, 20, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 11, 21, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    # pommel
    rect(draw, 10, 26, 3, 2, p["outline"], ox, oy, scale)
    dot(draw, 11, 27, p["hi"], ox, oy, scale)


def paint_shadow_cutter_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(12, 2), (19, 5), (21, 12), (20, 17), (17, 20), (13, 19), (13, 12), (12, 6)], p["outline"], ox, oy, scale)
    poly(draw, [(13, 4), (17, 6), (19, 12), (18, 15), (15, 18), (14, 13)], p["shade"], ox, oy, scale)
    rect(draw, 15, 8, 1, 8, p["mid"], ox, oy, scale)
    dot(draw, 18, 10, p["trim"], ox, oy, scale)
    poly(draw, [(7, 19), (17, 18), (19, 21), (6, 21)], p["outline"], ox, oy, scale)
    rect(draw, 12, 21, 3, 7, p["outline"], ox, oy, scale)
    rect(draw, 13, 22, 1, 5, (113, 72, 38, 255), ox, oy, scale)


# 15. 성스러운 창 — 빛 2H, 황금 창촉 + 깃발
def paint_holy_spear_item(draw, p, ox, oy, scale=4):
    # shaft
    rect(draw, 12, 8, 3, 22, p["outline"], ox, oy, scale)
    rect(draw, 13, 9, 1, 20, (113, 72, 38, 255), ox, oy, scale)
    # spear tip (diamond)
    poly(draw, [(13, 0), (18, 5), (13, 11), (9, 5)], p["outline"], ox, oy, scale)
    poly(draw, [(13, 2), (16, 5), (13, 9), (10, 5)], p["shade"], ox, oy, scale)
    poly(draw, [(13, 4), (15, 5), (13, 7), (11, 5)], p["mid"], ox, oy, scale)
    dot(draw, 13, 5, p["hi"], ox, oy, scale)
    # pennant (깃발, 옆으로 나부낌)
    poly(draw, [(14, 11), (22, 13), (20, 17), (14, 15)], p["outline"], ox, oy, scale)
    poly(draw, [(15, 12), (20, 13), (19, 16), (15, 14)], p["trim"], ox, oy, scale)
    rect(draw, 16, 13, 2, 2, p["hi"], ox, oy, scale)


def paint_holy_spear_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 14, 8, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 15, 9, 1, 22, (113, 72, 38, 255), ox, oy, scale)
    poly(draw, [(15, 0), (21, 6), (15, 12), (10, 6)], p["outline"], ox, oy, scale)
    poly(draw, [(15, 2), (18, 6), (15, 10), (11, 6)], p["shade"], ox, oy, scale)
    poly(draw, [(15, 4), (17, 6), (15, 8), (12, 6)], p["mid"], ox, oy, scale)
    poly(draw, [(16, 12), (25, 14), (22, 18), (16, 16)], p["outline"], ox, oy, scale)
    poly(draw, [(17, 13), (23, 14), (21, 17), (17, 15)], p["trim"], ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# Tier B (5종) — 다음 사이클 확장
# ───────────────────────────────────────────────────────────────────────

# 16. 용의 화염 — 화염 2H greatsword, 용 비늘 블레이드
def paint_dragon_flame_item(draw, p, ox, oy, scale=4):
    # flame-shaped blade (curved)
    poly(draw, [(11, 2), (15, 4), (16, 9), (14, 14), (15, 18), (11, 20), (8, 18), (9, 14), (7, 9), (8, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(12, 4), (14, 5), (15, 10), (13, 14), (14, 17), (11, 18), (9, 17), (10, 14), (8, 10), (10, 5)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 6), (13, 7), (13, 13), (11, 16), (10, 13), (10, 7)], p["mid"], ox, oy, scale)
    rect(draw, 11, 8, 1, 8, p["hi"], ox, oy, scale)
    # scale rivets on blade (dragon scale detail)
    dot(draw, 12, 11, p["trim"], ox, oy, scale)
    dot(draw, 11, 13, p["trim"], ox, oy, scale)
    # flared crossguard with claws
    poly(draw, [(4, 20), (19, 20), (20, 22), (3, 22)], p["outline"], ox, oy, scale)
    poly(draw, [(5, 20), (7, 18), (5, 20)], p["outline"], ox, oy, scale)
    poly(draw, [(16, 20), (18, 18), (18, 20)], p["outline"], ox, oy, scale)
    rect(draw, 8, 20, 7, 2, p["trim"], ox, oy, scale)
    # grip
    rect(draw, 10, 22, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 11, 23, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    rect(draw, 10, 28, 3, 2, p["trim"], ox, oy, scale)


def paint_dragon_flame_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(13, 2), (17, 4), (18, 10), (16, 15), (17, 19), (13, 21), (10, 19), (11, 15), (9, 10), (10, 4)], p["outline"], ox, oy, scale)
    rect(draw, 13, 8, 1, 9, p["hi"], ox, oy, scale)
    dot(draw, 14, 11, p["trim"], ox, oy, scale)
    poly(draw, [(5, 21), (21, 21), (22, 23), (4, 23)], p["outline"], ox, oy, scale)
    rect(draw, 10, 21, 7, 2, p["trim"], ox, oy, scale)
    rect(draw, 12, 23, 3, 7, p["outline"], ox, oy, scale)
    rect(draw, 13, 24, 1, 5, (113, 72, 38, 255), ox, oy, scale)


# 17. 세계수의 검 — 자연 1H sword, 잎사귀 날
def paint_worldtree_sword_item(draw, p, ox, oy, scale=4):
    # leaf-shaped blade
    poly(draw, [(11, 1), (14, 4), (15, 10), (13, 15), (11, 18), (9, 15), (7, 10), (8, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(11, 3), (13, 5), (14, 10), (12, 14), (11, 16), (10, 14), (8, 10), (9, 5)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 5), (12, 7), (12, 12), (11, 14), (10, 12), (10, 7)], p["mid"], ox, oy, scale)
    # leaf vein (central highlight)
    rect(draw, 11, 4, 1, 13, p["hi"], ox, oy, scale)
    # side vein details (좌우로 대각 1px)
    dot(draw, 9, 9, p["trim"], ox, oy, scale)
    dot(draw, 13, 9, p["trim"], ox, oy, scale)
    dot(draw, 9, 12, p["trim"], ox, oy, scale)
    dot(draw, 13, 12, p["trim"], ox, oy, scale)
    # vine-wrapped crossguard
    poly(draw, [(6, 18), (16, 18), (17, 20), (5, 20)], p["outline"], ox, oy, scale)
    rect(draw, 7, 18, 9, 1, p["trim"], ox, oy, scale)
    # grip (with vine wrap)
    rect(draw, 10, 20, 3, 6, p["outline"], ox, oy, scale)
    rect(draw, 11, 21, 1, 4, (113, 72, 38, 255), ox, oy, scale)
    dot(draw, 11, 22, p["trim"], ox, oy, scale)
    dot(draw, 11, 24, p["trim"], ox, oy, scale)
    rect(draw, 10, 26, 3, 2, p["outline"], ox, oy, scale)


def paint_worldtree_sword_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(13, 1), (16, 4), (17, 11), (15, 16), (13, 19), (11, 16), (9, 11), (10, 4)], p["outline"], ox, oy, scale)
    rect(draw, 13, 4, 1, 14, p["hi"], ox, oy, scale)
    dot(draw, 11, 10, p["trim"], ox, oy, scale)
    dot(draw, 15, 10, p["trim"], ox, oy, scale)
    poly(draw, [(7, 19), (19, 19), (20, 21), (6, 21)], p["outline"], ox, oy, scale)
    rect(draw, 8, 19, 11, 1, p["trim"], ox, oy, scale)
    rect(draw, 12, 21, 3, 7, p["outline"], ox, oy, scale)
    rect(draw, 13, 22, 1, 5, (113, 72, 38, 255), ox, oy, scale)


# 18. 신전 도시의 지팡이 — 빛 2H staff, 고대 제관 원반
def paint_temple_city_staff_item(draw, p, ox, oy, scale=4):
    # shaft
    rect(draw, 12, 8, 3, 22, p["outline"], ox, oy, scale)
    rect(draw, 13, 9, 1, 20, p["shade"], ox, oy, scale)
    # sun disc head (원반형)
    poly(draw, [(8, 1), (18, 1), (20, 4), (20, 8), (18, 11), (8, 11), (6, 8), (6, 4)], p["outline"], ox, oy, scale)
    poly(draw, [(9, 2), (17, 2), (19, 4), (19, 8), (17, 10), (9, 10), (7, 8), (7, 4)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 3), (16, 3), (18, 5), (18, 7), (16, 9), (10, 9), (8, 7), (8, 5)], p["mid"], ox, oy, scale)
    # inner sun rays (원반 중앙 십자)
    rect(draw, 12, 4, 3, 5, p["trim"], ox, oy, scale)
    rect(draw, 10, 5, 7, 1, p["trim"], ox, oy, scale)
    rect(draw, 10, 7, 7, 1, p["trim"], ox, oy, scale)
    # center jewel
    rect(draw, 13, 6, 1, 1, p["hi"], ox, oy, scale)
    # grip band
    rect(draw, 12, 16, 3, 2, p["trim"], ox, oy, scale)


def paint_temple_city_staff_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 14, 8, 3, 24, p["outline"], ox, oy, scale)
    rect(draw, 15, 9, 1, 22, p["shade"], ox, oy, scale)
    poly(draw, [(9, 1), (21, 1), (23, 5), (23, 9), (21, 12), (9, 12), (7, 9), (7, 5)], p["outline"], ox, oy, scale)
    poly(draw, [(10, 2), (20, 2), (22, 5), (22, 9), (20, 11), (10, 11), (8, 9), (8, 5)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 3), (19, 3), (21, 6), (21, 8), (19, 10), (11, 10), (9, 8), (9, 6)], p["mid"], ox, oy, scale)
    rect(draw, 14, 4, 3, 6, p["trim"], ox, oy, scale)
    rect(draw, 11, 6, 9, 1, p["trim"], ox, oy, scale)
    rect(draw, 14, 17, 3, 2, p["trim"], ox, oy, scale)


# 19. 광기의 갑주 — 버서커 plate, 고통 가시 + 피 얼룩
def paint_mad_armor_item(draw, p, ox, oy, scale=4):
    # jagged spiked shoulders
    poly(draw, [(2, 9), (6, 4), (8, 6), (4, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(20, 9), (24, 4), (26, 6), (22, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(3, 9), (5, 6), (7, 7), (4, 10)], p["shade"], ox, oy, scale)
    poly(draw, [(21, 9), (23, 6), (25, 7), (22, 10)], p["shade"], ox, oy, scale)
    # main plate
    poly(draw, [(6, 10), (22, 10), (25, 13), (24, 25), (14, 28), (4, 25), (3, 13)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 11), (21, 11), (23, 13), (22, 24), (14, 27), (5, 24), (5, 13)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 13), (19, 13), (21, 15), (20, 23), (14, 25), (7, 23), (7, 15)], p["mid"], ox, oy, scale)
    # jagged chest trim (분노 균열)
    poly(draw, [(10, 14), (12, 16), (14, 14), (16, 16), (18, 14)], p["trim"], ox, oy, scale)
    # central rage eye
    rect(draw, 13, 17, 2, 3, p["hi"], ox, oy, scale)
    rect(draw, 13, 18, 2, 1, p["outline"], ox, oy, scale)
    # bottom chaos spikes
    poly(draw, [(7, 25), (9, 28), (11, 25)], p["outline"], ox, oy, scale)
    poly(draw, [(17, 25), (19, 28), (21, 25)], p["outline"], ox, oy, scale)


def paint_mad_armor_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(2, 8), (7, 4), (10, 7), (5, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(22, 8), (27, 4), (30, 7), (27, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 9), (26, 9), (29, 12), (28, 26), (16, 30), (3, 26), (3, 12)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 10), (24, 10), (27, 12), (26, 25), (16, 28), (5, 25), (5, 12)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 13), (22, 13), (24, 16), (23, 24), (16, 26), (8, 24), (8, 16)], p["mid"], ox, oy, scale)
    poly(draw, [(12, 14), (14, 16), (16, 14), (18, 16), (20, 14)], p["trim"], ox, oy, scale)
    rect(draw, 15, 18, 2, 3, p["hi"], ox, oy, scale)


# 20. 세계수의 로브 — 자연 robe, 잎사귀 소매 + 가지 허리
def paint_worldtree_robe_item(draw, p, ox, oy, scale=4):
    # robe silhouette (taller, flowing)
    poly(draw, [(8, 3), (20, 3), (23, 8), (24, 26), (20, 29), (8, 29), (4, 26), (5, 8)], p["outline"], ox, oy, scale)
    poly(draw, [(9, 4), (19, 4), (22, 8), (22, 25), (19, 28), (9, 28), (6, 25), (6, 8)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 6), (17, 6), (20, 9), (20, 24), (18, 26), (10, 26), (8, 24), (8, 9)], p["mid"], ox, oy, scale)
    # leaf-shaped sleeves (양쪽 소매 끝에 잎)
    poly(draw, [(4, 14), (6, 18), (3, 18)], p["trim"], ox, oy, scale)
    poly(draw, [(24, 14), (22, 18), (25, 18)], p["trim"], ox, oy, scale)
    # branch-pattern belt
    rect(draw, 8, 17, 12, 2, p["outline"], ox, oy, scale)
    rect(draw, 9, 17, 10, 1, p["trim"], ox, oy, scale)
    # vine detail down center
    rect(draw, 13, 8, 2, 9, p["trim"], ox, oy, scale)
    dot(draw, 14, 10, p["hi"], ox, oy, scale)
    dot(draw, 14, 13, p["hi"], ox, oy, scale)
    # leaf accent on collar
    rect(draw, 12, 5, 4, 2, p["trim"], ox, oy, scale)


def paint_worldtree_robe_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(8, 3), (24, 3), (27, 9), (28, 28), (24, 31), (8, 31), (4, 28), (5, 9)], p["outline"], ox, oy, scale)
    poly(draw, [(9, 4), (23, 4), (26, 9), (26, 27), (23, 30), (9, 30), (6, 27), (6, 9)], p["shade"], ox, oy, scale)
    poly(draw, [(11, 6), (21, 6), (24, 10), (24, 26), (21, 28), (11, 28), (8, 26), (8, 10)], p["mid"], ox, oy, scale)
    poly(draw, [(4, 15), (7, 19), (3, 19)], p["trim"], ox, oy, scale)
    poly(draw, [(28, 15), (25, 19), (29, 19)], p["trim"], ox, oy, scale)
    rect(draw, 9, 18, 14, 2, p["outline"], ox, oy, scale)
    rect(draw, 10, 18, 12, 1, p["trim"], ox, oy, scale)
    rect(draw, 15, 9, 2, 10, p["trim"], ox, oy, scale)


# ───────────────────────────────────────────────────────────────────────
# Tier C (5종) — 추가 엔드게임 커버리지 (signature 20 → 25)
# ───────────────────────────────────────────────────────────────────────

# 21. 에테르 거인의 대검 — 빛 2H greatsword, 거인 룬 + 2겹 crossguard
def paint_ether_giant_greatsword_item(draw, p, ox, oy, scale=4):
    # massive blade w/ rune slit
    poly(draw, [(11, 1), (15, 3), (15, 17), (11, 19), (7, 17), (7, 3)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 3), (11, 2), (14, 3), (14, 16), (11, 18), (8, 16)], p["shade"], ox, oy, scale)
    poly(draw, [(9, 5), (13, 5), (13, 15), (11, 17), (9, 15)], p["mid"], ox, oy, scale)
    rect(draw, 10, 6, 2, 10, p["hi"], ox, oy, scale)
    # rune slits in the blade (ether giant mark)
    rect(draw, 11, 8, 1, 1, p["trim"], ox, oy, scale)
    rect(draw, 11, 11, 1, 1, p["trim"], ox, oy, scale)
    rect(draw, 11, 14, 1, 1, p["trim"], ox, oy, scale)
    # double crossguard (upper)
    rect(draw, 4, 19, 15, 1, p["outline"], ox, oy, scale)
    rect(draw, 5, 19, 13, 1, p["trim"], ox, oy, scale)
    # lower guard
    rect(draw, 3, 21, 17, 1, p["outline"], ox, oy, scale)
    rect(draw, 4, 21, 15, 1, p["trim"], ox, oy, scale)
    # long grip (two-handed)
    rect(draw, 10, 22, 3, 8, p["outline"], ox, oy, scale)
    rect(draw, 11, 23, 1, 6, (113, 72, 38, 255), ox, oy, scale)
    # pommel
    rect(draw, 9, 30, 5, 2, p["outline"], ox, oy, scale)
    rect(draw, 10, 30, 3, 1, p["trim"], ox, oy, scale)


def paint_ether_giant_greatsword_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(13, 1), (17, 3), (17, 18), (13, 20), (9, 18), (9, 3)], p["outline"], ox, oy, scale)
    rect(draw, 12, 6, 2, 11, p["hi"], ox, oy, scale)
    rect(draw, 13, 9, 1, 1, p["trim"], ox, oy, scale)
    rect(draw, 13, 13, 1, 1, p["trim"], ox, oy, scale)
    rect(draw, 6, 20, 15, 1, p["outline"], ox, oy, scale)
    rect(draw, 5, 22, 17, 1, p["outline"], ox, oy, scale)
    rect(draw, 12, 23, 3, 8, p["outline"], ox, oy, scale)
    rect(draw, 13, 24, 1, 6, (113, 72, 38, 255), ox, oy, scale)


# 22. 영혼 절단자 — 어둠 1H dagger, 영혼 연기 blade
def paint_soul_reaper_item(draw, p, ox, oy, scale=4):
    # curved dagger blade (hooked tip)
    poly(draw, [(10, 3), (13, 4), (14, 7), (13, 12), (11, 16), (9, 16), (8, 12), (9, 7)], p["outline"], ox, oy, scale)
    poly(draw, [(11, 5), (12, 6), (12, 12), (11, 15), (10, 15), (10, 12), (10, 7)], p["shade"], ox, oy, scale)
    rect(draw, 11, 7, 1, 7, p["mid"], ox, oy, scale)
    # soul wisp accents
    dot(draw, 9, 9, p["hi"], ox, oy, scale)
    dot(draw, 13, 11, p["hi"], ox, oy, scale)
    # crossguard (short, skull-like)
    rect(draw, 7, 16, 9, 2, p["outline"], ox, oy, scale)
    rect(draw, 8, 16, 7, 1, p["trim"], ox, oy, scale)
    # soul orb in guard center
    rect(draw, 10, 16, 2, 1, p["hi"], ox, oy, scale)
    # grip (short 1H)
    rect(draw, 10, 18, 3, 5, p["outline"], ox, oy, scale)
    rect(draw, 11, 19, 1, 3, (113, 72, 38, 255), ox, oy, scale)
    # pommel (small)
    rect(draw, 9, 23, 5, 2, p["outline"], ox, oy, scale)
    rect(draw, 10, 23, 3, 1, p["trim"], ox, oy, scale)
    # rising soul smoke particles
    dot(draw, 8, 2, p["trim"], ox, oy, scale)
    dot(draw, 14, 3, p["trim"], ox, oy, scale)


def paint_soul_reaper_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(12, 4), (15, 5), (16, 9), (15, 14), (13, 18), (11, 18), (9, 14), (11, 9), (11, 5)], p["outline"], ox, oy, scale)
    rect(draw, 13, 9, 1, 7, p["mid"], ox, oy, scale)
    dot(draw, 15, 13, p["hi"], ox, oy, scale)
    rect(draw, 9, 18, 9, 2, p["outline"], ox, oy, scale)
    rect(draw, 12, 20, 3, 5, p["outline"], ox, oy, scale)
    rect(draw, 13, 21, 1, 3, (113, 72, 38, 255), ox, oy, scale)


# 23. 대지의 심판 — 대지 2H warhammer, 네모난 대형 해머 머리
def paint_earth_verdict_item(draw, p, ox, oy, scale=4):
    # large rectangular hammer head
    rect(draw, 4, 3, 17, 10, p["outline"], ox, oy, scale)
    rect(draw, 5, 4, 15, 8, p["shade"], ox, oy, scale)
    rect(draw, 7, 5, 11, 6, p["mid"], ox, oy, scale)
    # earth rune (crossed lines)
    rect(draw, 10, 6, 1, 4, p["trim"], ox, oy, scale)
    rect(draw, 14, 6, 1, 4, p["trim"], ox, oy, scale)
    rect(draw, 9, 8, 7, 1, p["trim"], ox, oy, scale)
    # center gem (earth core)
    rect(draw, 11, 7, 3, 2, p["hi"], ox, oy, scale)
    # rivets at corners
    dot(draw, 5, 4, p["trim"], ox, oy, scale)
    dot(draw, 19, 4, p["trim"], ox, oy, scale)
    dot(draw, 5, 11, p["trim"], ox, oy, scale)
    dot(draw, 19, 11, p["trim"], ox, oy, scale)
    # shaft
    rect(draw, 11, 13, 3, 16, p["outline"], ox, oy, scale)
    rect(draw, 12, 14, 1, 14, (113, 72, 38, 255), ox, oy, scale)
    # pommel ring
    rect(draw, 10, 29, 5, 2, p["outline"], ox, oy, scale)
    rect(draw, 11, 29, 3, 1, p["trim"], ox, oy, scale)


def paint_earth_verdict_wearable(draw, p, ox, oy, scale=2):
    rect(draw, 5, 3, 19, 11, p["outline"], ox, oy, scale)
    rect(draw, 7, 4, 15, 9, p["shade"], ox, oy, scale)
    rect(draw, 9, 5, 11, 7, p["mid"], ox, oy, scale)
    rect(draw, 13, 7, 3, 2, p["hi"], ox, oy, scale)
    rect(draw, 13, 14, 3, 17, p["outline"], ox, oy, scale)
    rect(draw, 14, 15, 1, 15, (113, 72, 38, 255), ox, oy, scale)


# 24. 심해의 수호복 — 냉기 plate armor, 비늘 표면 + 산호 액센트
def paint_abyssal_guardian_item(draw, p, ox, oy, scale=4):
    # plate silhouette (broader bottom)
    poly(draw, [(5, 4), (8, 2), (16, 2), (19, 4), (22, 9), (21, 25), (17, 29), (7, 29), (3, 25), (2, 9)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 5), (9, 3), (15, 3), (18, 5), (20, 9), (19, 24), (16, 28), (8, 28), (5, 24), (4, 9)], p["shade"], ox, oy, scale)
    poly(draw, [(8, 7), (11, 5), (13, 5), (16, 7), (18, 10), (17, 23), (15, 26), (9, 26), (7, 23), (6, 10)], p["mid"], ox, oy, scale)
    # scale pattern (3 rows of diamond scales)
    dot(draw, 10, 11, p["trim"], ox, oy, scale)
    dot(draw, 14, 11, p["trim"], ox, oy, scale)
    dot(draw, 12, 13, p["trim"], ox, oy, scale)
    dot(draw, 10, 15, p["trim"], ox, oy, scale)
    dot(draw, 14, 15, p["trim"], ox, oy, scale)
    dot(draw, 12, 17, p["trim"], ox, oy, scale)
    dot(draw, 10, 19, p["trim"], ox, oy, scale)
    dot(draw, 14, 19, p["trim"], ox, oy, scale)
    # coral accents on shoulders
    rect(draw, 5, 7, 2, 2, p["hi"], ox, oy, scale)
    rect(draw, 17, 7, 2, 2, p["hi"], ox, oy, scale)
    # belt
    rect(draw, 6, 22, 13, 2, p["outline"], ox, oy, scale)
    rect(draw, 7, 22, 11, 1, p["trim"], ox, oy, scale)
    # center pearl (abyssal core)
    rect(draw, 11, 12, 2, 2, p["hi"], ox, oy, scale)


def paint_abyssal_guardian_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(6, 4), (10, 2), (22, 2), (26, 4), (29, 10), (28, 28), (24, 31), (8, 31), (4, 28), (3, 10)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 5), (11, 4), (21, 4), (24, 5), (27, 11), (26, 27), (23, 30), (9, 30), (6, 27), (5, 11)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 7), (13, 6), (19, 6), (22, 7), (24, 11), (23, 25), (20, 28), (12, 28), (9, 25), (8, 11)], p["mid"], ox, oy, scale)
    dot(draw, 14, 14, p["trim"], ox, oy, scale)
    dot(draw, 18, 14, p["trim"], ox, oy, scale)
    dot(draw, 16, 18, p["trim"], ox, oy, scale)
    rect(draw, 15, 12, 2, 3, p["hi"], ox, oy, scale)


# 25. 혼돈의 갑주 — 어둠 plate armor, 가시 어깨 + 혼돈 균열 가슴
def paint_chaos_armor_item(draw, p, ox, oy, scale=4):
    # spiked shoulder blades (sharp inward)
    poly(draw, [(2, 5), (7, 2), (9, 8), (4, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(22, 5), (17, 2), (15, 8), (20, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(3, 6), (6, 4), (8, 8), (5, 10)], p["shade"], ox, oy, scale)
    poly(draw, [(21, 6), (18, 4), (16, 8), (19, 10)], p["shade"], ox, oy, scale)
    # main chaos plate
    poly(draw, [(5, 9), (8, 7), (16, 7), (19, 9), (21, 12), (20, 26), (17, 29), (7, 29), (4, 26), (3, 12)], p["outline"], ox, oy, scale)
    poly(draw, [(7, 10), (9, 8), (15, 8), (17, 10), (19, 12), (18, 25), (16, 28), (8, 28), (6, 25), (5, 12)], p["shade"], ox, oy, scale)
    poly(draw, [(8, 11), (11, 10), (13, 10), (16, 11), (17, 13), (16, 24), (14, 27), (10, 27), (8, 24), (7, 13)], p["mid"], ox, oy, scale)
    # chaos crack (jagged Z shape on chest)
    poly(draw, [(10, 13), (13, 15), (11, 17), (14, 19), (12, 21), (14, 23)], p["trim"], ox, oy, scale)
    # chaos core (void center)
    rect(draw, 11, 18, 2, 3, p["hi"], ox, oy, scale)
    rect(draw, 11, 19, 2, 1, p["outline"], ox, oy, scale)
    # bottom spike hem
    poly(draw, [(7, 28), (9, 31), (11, 28)], p["outline"], ox, oy, scale)
    poly(draw, [(13, 28), (15, 31), (17, 28)], p["outline"], ox, oy, scale)


def paint_chaos_armor_wearable(draw, p, ox, oy, scale=2):
    poly(draw, [(2, 5), (8, 2), (10, 8), (5, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(28, 5), (22, 2), (20, 8), (25, 11)], p["outline"], ox, oy, scale)
    poly(draw, [(6, 9), (10, 7), (20, 7), (24, 9), (26, 12), (25, 26), (22, 29), (8, 29), (5, 26), (4, 12)], p["outline"], ox, oy, scale)
    poly(draw, [(8, 10), (12, 8), (18, 8), (22, 10), (24, 13), (23, 25), (20, 28), (10, 28), (7, 25), (6, 13)], p["shade"], ox, oy, scale)
    poly(draw, [(10, 12), (14, 11), (16, 11), (20, 12), (21, 14), (20, 24), (18, 26), (12, 26), (10, 24), (9, 14)], p["mid"], ox, oy, scale)
    poly(draw, [(13, 14), (16, 16), (14, 18), (17, 20), (15, 22)], p["trim"], ox, oy, scale)
    rect(draw, 14, 19, 2, 3, p["hi"], ox, oy, scale)


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
    # ── Tier A ──────────────────────────────────────────────
    Signature(
        slug="signature-armor-dragon-lord",
        item_name="드래곤로드 갑주",
        tone_key="fire",
        family="armor",
        item_painter=paint_dragon_lord_armor_item,
        wearable_painter=paint_dragon_lord_armor_wearable,
    ),
    Signature(
        slug="signature-armor-dark-lord-cloak",
        item_name="암흑 군주의 망토",
        tone_key="shadow",
        family="armor",
        item_painter=paint_dark_lord_cloak_item,
        wearable_painter=paint_dark_lord_cloak_wearable,
    ),
    Signature(
        slug="signature-weapon-worldtree-staff",
        item_name="세계수의 지팡이",
        tone_key="nature",
        family="weapon",
        item_painter=paint_worldtree_staff_item,
        wearable_painter=paint_worldtree_staff_wearable,
    ),
    Signature(
        slug="signature-shield-aegis-dimension",
        item_name="차원 방패 이지스",
        tone_key="holy",
        family="shield",
        item_painter=paint_aegis_shield_item,
        wearable_painter=paint_aegis_shield_wearable,
    ),
    Signature(
        slug="signature-shield-ether-grimoire",
        item_name="에테르 그리모어",
        tone_key="arcane",
        family="shield",
        item_painter=paint_ether_grimoire_item,
        wearable_painter=paint_ether_grimoire_wearable,
    ),
    Signature(
        slug="signature-weapon-divine-wrath-staff",
        item_name="천벌의 지팡이",
        tone_key="holy",
        family="weapon",
        item_painter=paint_divine_wrath_staff_item,
        wearable_painter=paint_divine_wrath_staff_wearable,
    ),
    Signature(
        slug="signature-weapon-frost-crown-sword",
        item_name="빙결의 왕관검",
        tone_key="frost",
        family="weapon",
        item_painter=paint_frost_crown_sword_item,
        wearable_painter=paint_frost_crown_sword_wearable,
    ),
    Signature(
        slug="signature-weapon-wind-ultimate-bow",
        item_name="바람의 궁극",
        tone_key="nature",
        family="weapon",
        item_painter=paint_wind_ultimate_bow_item,
        wearable_painter=paint_wind_ultimate_bow_wearable,
    ),
    Signature(
        slug="signature-weapon-shadow-cutter",
        item_name="그림자 절단기",
        tone_key="shadow",
        family="weapon",
        item_painter=paint_shadow_cutter_item,
        wearable_painter=paint_shadow_cutter_wearable,
    ),
    Signature(
        slug="signature-weapon-holy-spear",
        item_name="성스러운 창",
        tone_key="holy",
        family="weapon",
        item_painter=paint_holy_spear_item,
        wearable_painter=paint_holy_spear_wearable,
    ),
    # ── Tier B ──────────────────────────────────────────────
    Signature(
        slug="signature-weapon-dragon-flame",
        item_name="용의 화염",
        tone_key="fire",
        family="weapon",
        item_painter=paint_dragon_flame_item,
        wearable_painter=paint_dragon_flame_wearable,
    ),
    Signature(
        slug="signature-weapon-worldtree-sword",
        item_name="세계수의 검",
        tone_key="nature",
        family="weapon",
        item_painter=paint_worldtree_sword_item,
        wearable_painter=paint_worldtree_sword_wearable,
    ),
    Signature(
        slug="signature-weapon-temple-city-staff",
        item_name="신전 도시의 지팡이",
        tone_key="holy",
        family="weapon",
        item_painter=paint_temple_city_staff_item,
        wearable_painter=paint_temple_city_staff_wearable,
    ),
    Signature(
        slug="signature-armor-mad-armor",
        item_name="광기의 갑주",
        tone_key="rust",
        family="armor",
        item_painter=paint_mad_armor_item,
        wearable_painter=paint_mad_armor_wearable,
    ),
    Signature(
        slug="signature-armor-worldtree-robe",
        item_name="세계수의 로브",
        tone_key="nature",
        family="armor",
        item_painter=paint_worldtree_robe_item,
        wearable_painter=paint_worldtree_robe_wearable,
    ),
    # ── Tier C ──────────────────────────────────────────────
    Signature(
        slug="signature-weapon-ether-giant-greatsword",
        item_name="에테르 거인의 대검",
        tone_key="holy",
        family="weapon",
        item_painter=paint_ether_giant_greatsword_item,
        wearable_painter=paint_ether_giant_greatsword_wearable,
    ),
    Signature(
        slug="signature-weapon-soul-reaper",
        item_name="영혼 절단자",
        tone_key="shadow",
        family="weapon",
        item_painter=paint_soul_reaper_item,
        wearable_painter=paint_soul_reaper_wearable,
    ),
    Signature(
        slug="signature-weapon-earth-verdict",
        item_name="대지의 심판",
        tone_key="earth",
        family="weapon",
        item_painter=paint_earth_verdict_item,
        wearable_painter=paint_earth_verdict_wearable,
    ),
    Signature(
        slug="signature-armor-abyssal-guardian",
        item_name="심해의 수호복",
        tone_key="frost",
        family="armor",
        item_painter=paint_abyssal_guardian_item,
        wearable_painter=paint_abyssal_guardian_wearable,
    ),
    Signature(
        slug="signature-armor-chaos-armor",
        item_name="혼돈의 갑주",
        tone_key="shadow",
        family="armor",
        item_painter=paint_chaos_armor_item,
        wearable_painter=paint_chaos_armor_wearable,
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
