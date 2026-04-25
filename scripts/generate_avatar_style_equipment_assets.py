from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


REPO_ROOT = Path(__file__).resolve().parent.parent
AVATAR_ROOT = REPO_ROOT / "public" / "assets" / "avatars"
ITEM_OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "items"
OVERLAY_OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "overlays"
ARTIFACT_DIR = REPO_ROOT / "output" / "imagegen" / "avatar-style-equipment-family"
PALETTE_JSON = REPO_ROOT / "src" / "data" / "artPalette.json"


def _hex_to_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    clean = hex_color.lstrip("#")
    if len(clean) != 6:
        return (0, 0, 0, alpha)
    return (
        int(clean[0:2], 16),
        int(clean[2:4], 16),
        int(clean[4:6], 16),
        alpha,
    )


def load_shared_palettes() -> dict[str, dict[str, tuple[int, int, int, int]]]:
    """artPalette.json에서 tone palette를 로드해서 PIL RGBA 튜플 딕트로 변환.

    생성 스크립트는 outline / shade / mid / hi / trim 5-key 구조를 쓴다.
    leather/darkLeather는 기존 코드 호환용으로 leather 팔레트에서 복제.
    """
    raw = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    tones = raw["tonePalettes"]
    default_leather = tones.get("leather", {})
    converted: dict[str, dict[str, tuple[int, int, int, int]]] = {}
    for key, palette in tones.items():
        leather_src = palette if key == "leather" else default_leather
        converted[key] = {
            "outline": _hex_to_rgba(palette["outline"]),
            "shade": _hex_to_rgba(palette["shade"]),
            "mid": _hex_to_rgba(palette["mid"]),
            "hi": _hex_to_rgba(palette["hi"]),
            "trim": _hex_to_rgba(palette["trim"]),
            "leather": _hex_to_rgba(leather_src.get("mid", "#7d5a3a")),
            "darkLeather": _hex_to_rgba(leather_src.get("shade", "#3a261a")),
        }
    return converted

ITEM_CANVAS = (160, 160)
OVERLAY_CANVAS = (72, 72)
SOURCE_CANVAS = (572, 871)


ITEM_REGIONS = {
    "weapon-sword": {
        "manual": "sword",
    },
    "weapon-dagger": {
        "manual": "dagger",
    },
    "weapon-heavy": {
        "manual": "heavy",
    },
    "weapon-bow": {
        "manual": "bow",
    },
    "weapon-staff": {
        "manual": "staff",
    },
    "weapon-lance": {
        "manual": "lance",
    },
    "weapon-whip": {
        "manual": "whip",
    },
    "offhand-shield": {
        "manual": "shield",
    },
    "offhand-book": {
        "manual": "book",
    },
    "headgear-straw-hat": {
        "manual": "straw-hat",
    },
    "headgear-cap": {
        "manual": "cap",
    },
    "headgear-wizard-hat": {
        "manual": "wizard-hat",
    },
    "headgear-circlet": {
        "manual": "circlet",
    },
    "headgear-helm": {
        "manual": "helm",
    },
    "headgear-hood": {
        "manual": "hood",
    },
    "headgear-mask": {
        "manual": "mask",
    },
    "armor-coat": {
        "manual": "coat",
    },
    "armor-leather": {
        "manual": "leather",
    },
    "armor-robe": {
        "manual": "robe",
    },
    "armor-plate": {
        "manual": "plate",
    },
    "armor-cloak": {
        "manual": "cloak",
    },
    "armor-boots": {
        "manual": "boots",
    },
}

EQUIPMENT_OVERLAY_REGIONS = {
    "weapon-sword": {
        "manual": "sword",
    },
    "weapon-dagger": {
        "manual": "dagger",
    },
    "weapon-heavy": {
        "manual": "heavy",
    },
    "weapon-bow": {
        "manual": "bow",
    },
    "weapon-staff": {
        "manual": "staff",
    },
    "weapon-lance": {
        "manual": "lance",
    },
    "weapon-whip": {
        "manual": "whip",
    },
    "offhand-shield": {
        "manual": "shield",
    },
    "offhand-book": {
        "manual": "book",
    },
    "headgear-straw-hat": {
        "manual": "straw-hat",
    },
    "headgear-cap": {
        "manual": "cap",
    },
    "headgear-wizard-hat": {
        "manual": "wizard-hat",
    },
    "headgear-circlet": {
        "manual": "circlet",
    },
    "headgear-helm": {
        "manual": "helm",
    },
    "headgear-hood": {
        "manual": "hood",
    },
    "headgear-mask": {
        "manual": "mask",
    },
    "armor-coat": {
        "manual": "coat",
    },
    "armor-leather": {
        "manual": "leather",
    },
    "armor-robe": {
        "manual": "robe",
    },
    "armor-plate": {
        "manual": "plate",
    },
    "armor-cloak": {
        "manual": "cloak",
    },
    "armor-boots": {
        "manual": "boots",
    },
}


def make_dirs() -> None:
    ITEM_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OVERLAY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def load_source(source_name: str) -> Image.Image:
    image = Image.open(AVATAR_ROOT / source_name).convert("RGBA")
    return ImageEnhance.Color(ImageEnhance.Contrast(ImageEnhance.Sharpness(image).enhance(1.1)).enhance(1.05)).enhance(1.04)


def crop_region(image: Image.Image, region: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(region)
    bbox = crop.getchannel("A").getbbox()
    return crop.crop(bbox) if bbox else crop


def trim_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def fit_on_canvas(image: Image.Image, canvas_size: tuple[int, int], box: tuple[int, int, int, int]) -> Image.Image:
    x, y, width, height = box
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    paste_x = x + (width - copy.width) // 2
    paste_y = y + (height - copy.height) // 2
    canvas.alpha_composite(copy, (paste_x, paste_y))
    return canvas


def isolate_overlay_region(source_name: str, region: tuple[int, int, int, int]) -> Image.Image:
    source = load_source(source_name)
    overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    crop = source.crop(region)
    overlay.alpha_composite(crop, (region[0], region[1]))
    return overlay


def scale_pixel_blocks(blocks: list[tuple[int, int, int, int]], scale: int) -> list[tuple[int, int, int, int]]:
    return [(x * scale, y * scale, w * scale, h * scale) for x, y, w, h in blocks]


def draw_blocks(canvas: Image.Image, blocks: list[tuple[int, int, int, int]], fill: tuple[int, int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    for x, y, w, h in blocks:
        draw.rectangle((x, y, x + w - 1, y + h - 1), fill=fill)


def resolve_canvas_metrics(canvas_size: tuple[int, int], kind: str) -> tuple[int, int, int]:
    if canvas_size == ITEM_CANVAS:
        scale = 4
        offset_map = {
            "wizard-hat": (22, 20),
            "circlet": (26, 38),
            "mask": (28, 42),
            "straw-hat": (18, 26),
            "cap": (22, 34),
            "hood": (18, 22),
            "helm": (18, 24),
            "coat": (18, 16),
            "leather": (18, 16),
            "robe": (16, 14),
            "plate": (16, 14),
            "cloak": (14, 14),
            "boots": (20, 34),
        }
        return scale, *offset_map.get(kind, (20, 18))

    if canvas_size == OVERLAY_CANVAS:
        scale = 2
        offset_map = {
            "wizard-hat": (9, 4),
            "circlet": (14, 11),
            "mask": (15, 14),
            "straw-hat": (7, 5),
            "cap": (10, 8),
            "hood": (7, 5),
            "helm": (8, 6),
            "coat": (7, 7),
            "leather": (7, 7),
            "robe": (6, 6),
            "plate": (6, 6),
            "cloak": (5, 5),
            "boots": (10, 16),
        }
        return scale, *offset_map.get(kind, (8, 7))

    return 8, 96, 84


def draw_manual_family(kind: str, canvas_size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    scale, offset_x, offset_y = resolve_canvas_metrics(canvas_size, kind)
    # OVERLAY 모드에서는 무기류의 grip/pommel/lower-shaft를 생략한다.
    # 캐릭터의 손이 자연스럽게 그 자리를 가리도록 의도된 anchor.
    # ITEM 모드(인벤토리 아이콘)는 손잡이까지 그대로 그린다.
    is_overlay = canvas_size == OVERLAY_CANVAS

    # 공용 artPalette.json에서 로드 (런타임 JS와 정확히 동일 값).
    # plate 슬롯 전용 팔레트는 별도 키가 없으므로 steel에 plate 트림을 덮어씌움.
    shared_palettes = load_shared_palettes()
    palettes = dict(shared_palettes)
    if "steel" in shared_palettes:
        plate_override = dict(shared_palettes["steel"])
        plate_override["leather"] = _hex_to_rgba("#47537e")
        plate_override["darkLeather"] = _hex_to_rgba("#2a345e")
        palettes["plate"] = plate_override
    if "nature" in shared_palettes:
        palettes["cloak"] = shared_palettes["nature"]

    draw = ImageDraw.Draw(image)

    def px(value: int) -> int:
        return (value * scale) + offset_x

    def py(value: int) -> int:
        return (value * scale) + offset_y

    def rect(color_key: str, x: int, y: int, width: int, height: int) -> None:
        draw.rectangle((px(x), py(y), px(x + width) - 1, py(y + height) - 1), fill=colors[color_key])

    def poly(color_key: str, points: list[tuple[int, int]]) -> None:
        draw.polygon([(px(x), py(y)) for x, y in points], fill=colors[color_key])

    def line(color_key: str, start: tuple[int, int], end: tuple[int, int], width: int = 1) -> None:
        draw.line((px(start[0]), py(start[1]), px(end[0]), py(end[1])), fill=colors[color_key], width=max(1, width * scale))

    def dots(color_key: str, positions: list[tuple[int, int]]) -> None:
        for x, y in positions:
            rect(color_key, x, y, 1, 1)

    colors = palettes["steel"]
    if kind in {"bow", "whip", "boots", "cap"}:
        colors = palettes["wood"]
    elif kind in {"wizard-hat", "robe", "book", "staff"}:
        colors = palettes["arcane"]
    elif kind in {"shield", "circlet"}:
        colors = palettes["holy"]
    elif kind in {"hood", "cloak"}:
        colors = palettes["cloak"]
    elif kind in {"leather", "mask"}:
        colors = palettes["leather"]
    elif kind in {"plate", "helm"}:
        colors = palettes["plate"]
    elif kind == "straw-hat":
        colors = palettes["straw"]
    elif kind == "coat":
        colors = palettes["cloth"]

    if kind == "sword":
        # 블레이드 + 크로스가드는 항상 그린다 (overlay에서도 보여야 함)
        poly("outline", [(13, 1), (15, 3), (14, 5), (9, 18), (7, 18), (12, 4)])
        poly("shade", [(13, 2), (14, 3), (13, 5), (9, 17), (8, 17), (12, 5)])
        poly("mid", [(12, 2), (13, 3), (12, 5), (9, 16), (8, 16), (11, 5)])
        line("hi", (12, 3), (9, 15))
        rect("outline", 6, 18, 10, 2)
        rect("trim", 7, 18, 8, 1)
        if not is_overlay:
            # GRIP + POMMEL — 캐릭터 손에 가려질 영역. 인벤토리 아이콘에만 표시.
            rect("outline", 10, 20, 3, 5)
            rect("leather", 10, 21, 2, 3)
            rect("trim", 9, 25, 5, 2)
    elif kind == "dagger":
        # 블레이드 + 크로스가드는 항상
        poly("outline", [(12, 3), (14, 5), (11, 12), (9, 12), (11, 5)])
        poly("shade", [(12, 4), (13, 5), (11, 11), (10, 11), (11, 6)])
        poly("mid", [(11, 4), (12, 5), (10, 10), (10, 9)])
        line("hi", (11, 5), (10, 9))
        rect("outline", 7, 12, 9, 2)
        rect("trim", 8, 12, 7, 1)
        if not is_overlay:
            # GRIP + POMMEL — 손에 가려지는 영역
            rect("outline", 10, 14, 3, 4)
            rect("leather", 10, 15, 2, 2)
            rect("trim", 9, 18, 5, 1)
    elif kind == "heavy":
        # 도끼/대검 머리 + 자루 상단 — 항상 표시
        # overlay 모드에서는 자루 하단(y>=14) + 폼멜 트림(y=22) 생략해 손이 가리는 영역 정리
        if is_overlay:
            rect("outline", 8, 7, 3, 7)
            rect("leather", 8, 8, 2, 6)
        else:
            rect("outline", 8, 7, 3, 16)
            rect("leather", 8, 8, 2, 12)
        poly("outline", [(10, 4), (19, 4), (22, 7), (22, 13), (18, 16), (10, 16)])
        poly("shade", [(11, 5), (18, 5), (20, 7), (20, 12), (17, 14), (11, 14)])
        poly("mid", [(12, 6), (17, 6), (18, 8), (18, 11), (16, 13), (12, 13)])
        if not is_overlay:
            rect("trim", 9, 22, 5, 2)
        dots("hi", [(13, 7), (14, 9), (14, 11)])
    elif kind == "bow":
        poly("outline", [(7, 2), (6, 5), (5, 9), (5, 14), (6, 18), (7, 21), (9, 20), (8, 17), (8, 6), (9, 3)])
        poly("shade", [(8, 4), (7, 7), (7, 16), (8, 19), (9, 18), (9, 6)])
        poly("outline", [(17, 2), (18, 5), (19, 9), (19, 14), (18, 18), (17, 21), (15, 20), (16, 17), (16, 6), (15, 3)])
        poly("shade", [(16, 4), (17, 7), (17, 16), (16, 19), (15, 18), (15, 6)])
        line("trim", (9, 5), (15, 18))
        line("hi", (10, 6), (14, 17))
    elif kind == "staff":
        # 지팡이: orb(상단) + 샤프트. overlay에서는 손 위쪽만 보이도록 샤프트 하단 자름.
        if is_overlay:
            rect("outline", 11, 7, 3, 8)
            rect("leather", 11, 8, 2, 6)
        else:
            rect("outline", 11, 7, 3, 16)
            rect("leather", 11, 8, 2, 13)
        poly("outline", [(8, 3), (11, 1), (15, 1), (18, 3), (18, 7), (15, 9), (11, 9), (8, 7)])
        poly("shade", [(9, 4), (11, 2), (15, 2), (17, 4), (17, 6), (15, 8), (11, 8), (9, 6)])
        poly("mid", [(11, 3), (14, 3), (15, 4), (15, 6), (14, 7), (11, 7), (10, 6), (10, 4)])
        rect("trim", 11, 10, 3, 1)
        dots("hi", [(12, 3), (13, 4), (12, 5)])
    elif kind == "lance":
        # 창: 촉(상단) + 깃발 + 샤프트. overlay에서는 샤프트 하단(y>=15) + 폼멜 자름.
        if is_overlay:
            rect("outline", 11, 3, 2, 12)
            rect("leather", 11, 9, 1, 6)
        else:
            rect("outline", 11, 3, 2, 20)
            rect("leather", 11, 9, 1, 10)
        poly("outline", [(12, 0), (15, 4), (13, 8), (11, 8), (9, 4)])
        poly("shade", [(12, 2), (14, 4), (13, 6), (11, 6), (10, 4)])
        poly("mid", [(12, 3), (13, 4), (12, 5), (11, 4)])
        poly("trim", [(13, 10), (18, 12), (13, 14)])
        if not is_overlay:
            rect("trim", 9, 22, 5, 1)
    elif kind == "whip":
        # 채찍: 손잡이(y=17~19) + 채찍 곡선. overlay에서 손잡이는 손이 가리므로 생략.
        if not is_overlay:
            rect("outline", 8, 17, 5, 2)
            rect("leather", 9, 17, 3, 1)
        line("outline", (13, 17), (18, 15), 1)
        line("shade", (18, 15), (21, 12), 1)
        line("mid", (21, 12), (22, 9), 1)
        line("trim", (22, 9), (21, 7), 1)
    elif kind == "shield":
        poly("outline", [(12, 1), (17, 3), (19, 8), (18, 15), (12, 22), (6, 15), (5, 8), (7, 3)])
        poly("shade", [(12, 3), (16, 5), (17, 9), (16, 14), (12, 19), (8, 14), (7, 9), (8, 5)])
        poly("mid", [(12, 4), (15, 6), (15, 9), (14, 13), (12, 16), (10, 13), (9, 9), (9, 6)])
        rect("trim", 11, 5, 2, 12)
        rect("trim", 8, 10, 8, 2)
        dots("hi", [(10, 7), (11, 8), (10, 12)])
    elif kind == "book":
        rect("outline", 6, 5, 12, 13)
        rect("shade", 7, 6, 5, 11)
        rect("mid", 8, 7, 3, 9)
        rect("hi", 11, 7, 1, 9)
        rect("shade", 12, 6, 5, 11)
        rect("mid", 13, 7, 3, 9)
        rect("trim", 11, 4, 2, 14)
        rect("leather", 17, 7, 2, 9)
        dots("hi", [(14, 9), (15, 11)])
    elif kind == "straw-hat":
        poly("outline", [(3, 8), (21, 8), (20, 10), (4, 10)])
        poly("shade", [(5, 8), (19, 8), (18, 9), (6, 9)])
        poly("outline", [(7, 4), (17, 4), (18, 8), (6, 8)])
        poly("mid", [(8, 5), (16, 5), (16, 7), (8, 7)])
        rect("trim", 9, 6, 6, 1)
        dots("hi", [(8, 5), (11, 4), (15, 5)])
    elif kind == "cap":
        poly("outline", [(7, 8), (18, 8), (19, 11), (6, 11)])
        poly("shade", [(8, 8), (17, 8), (18, 10), (8, 10)])
        poly("outline", [(10, 4), (16, 4), (18, 8), (8, 8)])
        poly("mid", [(10, 5), (15, 5), (16, 7), (10, 7)])
        rect("trim", 14, 10, 5, 1)
    elif kind == "wizard-hat":
        poly("outline", [(11, 1), (15, 6), (16, 11), (8, 11)])
        poly("shade", [(11, 3), (14, 7), (14, 10), (9, 10)])
        poly("mid", [(11, 4), (13, 7), (13, 9), (10, 9)])
        poly("outline", [(5, 11), (19, 11), (20, 13), (4, 13)])
        poly("trim", [(8, 10), (16, 10), (15, 11), (9, 11)])
        dots("hi", [(12, 3), (12, 6), (13, 12)])
    elif kind == "circlet":
        poly("outline", [(6, 10), (18, 10), (17, 12), (7, 12)])
        poly("mid", [(7, 10), (17, 10), (16, 11), (8, 11)])
        poly("trim", [(11, 7), (13, 7), (14, 10), (10, 10)])
        dots("hi", [(12, 8)])
    elif kind == "helm":
        poly("outline", [(7, 4), (17, 4), (19, 8), (18, 15), (15, 18), (9, 18), (6, 15), (5, 8)])
        poly("shade", [(8, 5), (16, 5), (17, 8), (16, 14), (14, 16), (10, 16), (8, 14), (7, 8)])
        poly("mid", [(10, 6), (15, 6), (15, 10), (14, 13), (10, 13), (9, 10)])
        rect("trim", 10, 14, 6, 1)
        rect("hi", 12, 6, 1, 8)
    elif kind == "hood":
        poly("outline", [(7, 3), (16, 3), (18, 8), (17, 15), (13, 18), (10, 18), (6, 14), (5, 8)])
        poly("shade", [(8, 4), (15, 4), (16, 8), (15, 13), (12, 16), (10, 16), (7, 13), (6, 8)])
        poly("mid", [(9, 5), (14, 5), (14, 9), (12, 13), (10, 13), (8, 9)])
        dots("hi", [(10, 5), (9, 9)])
    elif kind == "mask":
        poly("outline", [(7, 9), (17, 9), (18, 12), (16, 15), (8, 15), (6, 12)])
        poly("shade", [(8, 10), (16, 10), (16, 13), (8, 13)])
        rect("mid", 9, 11, 2, 1)
        rect("mid", 13, 11, 2, 1)
        rect("trim", 11, 10, 2, 4)
    elif kind == "coat":
        poly("outline", [(9, 3), (15, 3), (17, 8), (17, 20), (14, 23), (10, 23), (7, 20), (7, 8)])
        poly("shade", [(10, 4), (14, 4), (16, 8), (16, 19), (13, 22), (11, 22), (8, 19), (8, 8)])
        poly("mid", [(10, 5), (14, 5), (15, 8), (15, 18), (13, 21), (11, 21), (9, 18), (9, 8)])
        rect("trim", 10, 5, 1, 15)
        rect("trim", 14, 5, 1, 15)
        rect("trim", 10, 8, 5, 2)
        rect("leather", 7, 11, 2, 4)
        rect("leather", 15, 11, 2, 4)
        dots("hi", [(11, 6), (12, 12), (12, 18)])
    elif kind == "leather":
        poly("outline", [(9, 4), (15, 4), (17, 8), (17, 20), (14, 23), (10, 23), (7, 20), (7, 8)])
        poly("shade", [(10, 5), (14, 5), (16, 8), (16, 19), (13, 22), (11, 22), (8, 19), (8, 8)])
        poly("mid", [(10, 6), (14, 6), (15, 9), (15, 18), (13, 21), (11, 21), (9, 18), (9, 9)])
        rect("trim", 10, 10, 5, 1)
        rect("trim", 11, 14, 3, 1)
        rect("darkLeather", 7, 12, 2, 5)
        rect("darkLeather", 15, 12, 2, 5)
        dots("hi", [(10, 7), (13, 8), (12, 16)])
    elif kind == "robe":
        poly("outline", [(9, 3), (15, 3), (18, 8), (17, 22), (14, 24), (10, 24), (7, 22), (6, 8)])
        poly("shade", [(10, 4), (14, 4), (16, 8), (16, 20), (13, 23), (11, 23), (8, 20), (8, 8)])
        poly("mid", [(10, 5), (14, 5), (15, 8), (15, 19), (13, 22), (11, 22), (9, 19), (9, 8)])
        rect("trim", 10, 5, 1, 16)
        rect("trim", 14, 5, 1, 16)
        rect("trim", 10, 9, 5, 2)
        dots("hi", [(11, 6), (13, 7), (12, 18)])
    elif kind == "plate":
        poly("outline", [(8, 4), (16, 4), (19, 8), (18, 20), (14, 24), (10, 24), (6, 20), (5, 8)])
        poly("shade", [(9, 5), (15, 5), (17, 8), (17, 19), (13, 23), (11, 23), (7, 19), (7, 8)])
        poly("mid", [(10, 6), (14, 6), (15, 9), (15, 18), (13, 22), (11, 22), (9, 18), (9, 9)])
        rect("trim", 10, 6, 5, 2)
        rect("trim", 10, 12, 5, 1)
        rect("darkLeather", 6, 12, 2, 6)
        rect("darkLeather", 16, 12, 2, 6)
        dots("hi", [(10, 7), (11, 9), (14, 10), (12, 17)])
    elif kind == "cloak":
        poly("outline", [(7, 4), (16, 4), (19, 8), (18, 23), (13, 24), (8, 21), (6, 15), (5, 8)])
        poly("shade", [(8, 5), (15, 5), (17, 8), (16, 21), (12, 22), (9, 20), (7, 15), (6, 8)])
        poly("mid", [(9, 6), (14, 6), (15, 9), (14, 18), (11, 20), (9, 18), (8, 14), (8, 9)])
        rect("trim", 10, 5, 4, 2)
        line("hi", (9, 8), (10, 18))
    elif kind == "boots":
        poly("outline", [(6, 12), (11, 12), (12, 20), (5, 20)])
        poly("shade", [(7, 13), (10, 13), (10, 18), (6, 18)])
        poly("mid", [(7, 17), (10, 17), (11, 19), (6, 19)])
        poly("outline", [(14, 12), (19, 12), (20, 20), (13, 20)])
        poly("shade", [(15, 13), (18, 13), (18, 18), (14, 18)])
        poly("mid", [(15, 17), (18, 17), (19, 19), (14, 19)])
        rect("trim", 7, 13, 3, 1)
        rect("trim", 15, 13, 3, 1)

    return image


def build_item_image(key: str, config: dict[str, object]) -> Image.Image:
    manual = config.get("manual")
    if manual:
        return draw_manual_family(str(manual), ITEM_CANVAS)

    source = load_source(str(config["source"]))
    crop = crop_region(source, tuple(config["crop"]))
    return fit_on_canvas(crop, ITEM_CANVAS, tuple(config["item_box"]))


def build_overlay_image(key: str, config: dict[str, object]) -> Image.Image:
    manual = config.get("manual")
    if manual:
        return draw_manual_family(str(manual), OVERLAY_CANVAS)

    source = load_source(str(config["source"]))
    crop = crop_region(source, tuple(config["crop"]))
    return fit_on_canvas(crop, OVERLAY_CANVAS, tuple(config.get("overlay_box", (8, 8, 56, 56))))


def save_contact_sheet(images: dict[str, Image.Image], out_path: Path, tile_size: tuple[int, int]) -> None:
    columns = 4
    tile_w, tile_h = tile_size
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_w, rows * tile_h), (7, 11, 16, 255))
    draw = ImageDraw.Draw(sheet)
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
    make_dirs()

    item_images = {key: build_item_image(key, config) for key, config in ITEM_REGIONS.items()}
    overlay_images = {key: build_overlay_image(key, config) for key, config in EQUIPMENT_OVERLAY_REGIONS.items()}

    for key, image in item_images.items():
        image.save(ITEM_OUTPUT_DIR / f"{key}.png")

    for key, image in overlay_images.items():
        image.save(OVERLAY_OUTPUT_DIR / f"{key}.png")

    save_contact_sheet(item_images, ARTIFACT_DIR / "items-contact-sheet.png", (180, 180))
    save_contact_sheet(
        {key: fit_on_canvas(trim_alpha(image), ITEM_CANVAS, (24, 18, 112, 124))
         for key, image in overlay_images.items()},
        ARTIFACT_DIR / "overlays-contact-sheet.png",
        (180, 180),
    )

    manifest = {
        "items": sorted(item_images.keys()),
        "overlays": sorted(overlay_images.keys()),
    }
    (ARTIFACT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
