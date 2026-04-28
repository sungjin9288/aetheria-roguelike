from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = Path("/tmp/aetheria_equipment_manifest.json")
FAMILY_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "items"
WEARABLE_FAMILY_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "overlays"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
WEARABLE_OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-wearable-exact"
ARTIFACT_DIR = REPO_ROOT / "output" / "imagegen" / "avatar-style-equipment-exact"
WEARABLE_ARTIFACT_DIR = REPO_ROOT / "output" / "imagegen" / "avatar-style-equipment-wearable"
BASE_PREVIEW_AVATAR = REPO_ROOT / "public" / "assets" / "avatars" / "adventurer-coat.png"

CANVAS_SIZE = (160, 160)
WEARABLE_CANVAS = (72, 72)

ELEMENT_PALETTES = {
    "": {"accent": (232, 212, 173), "shade": (119, 88, 61)},
    "화염": {"accent": (255, 182, 97), "shade": (174, 74, 44)},
    "불": {"accent": (255, 182, 97), "shade": (174, 74, 44)},
    "화염속성": {"accent": (255, 182, 97), "shade": (174, 74, 44)},
    "냉기": {"accent": (173, 230, 255), "shade": (76, 122, 182)},
    "얼음": {"accent": (173, 230, 255), "shade": (76, 122, 182)},
    "빛": {"accent": (255, 234, 163), "shade": (203, 158, 71)},
    "자연": {"accent": (162, 231, 154), "shade": (72, 133, 62)},
    "대지": {"accent": (220, 190, 140), "shade": (130, 97, 63)},
    "어둠": {"accent": (184, 163, 255), "shade": (89, 62, 145)},
    "에테르": {"accent": (164, 237, 255), "shade": (77, 134, 180)},
    "바람": {"accent": (195, 255, 196), "shade": (90, 150, 96)},
}

TIER_GLOWS = {
    1: (255, 255, 255, 0),
    2: (160, 230, 180, 56),
    3: (120, 180, 255, 64),
    4: (196, 146, 255, 74),
    5: (255, 214, 120, 84),
    6: (143, 227, 255, 96),
}

WOOD_HINTS = ("나무", "목재", "포크", "곤봉", "지팡이", "장궁", "활", "완드")
RUST_HINTS = ("녹슨", "낡은")
HOLY_HINTS = ("성", "천공", "천상", "팔라딘", "심판", "성광")
ARCANE_HINTS = ("마법", "주문", "룬", "그리모어", "마도", "현자", "아크", "에테르", "차원")
SHADOW_HINTS = ("암흑", "어둠", "심연", "공허", "혼돈", "그림자")
NATURE_HINTS = ("세계수", "정령", "숲", "엘프", "레인저", "자연", "사냥")


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    WEARABLE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WEARABLE_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def load_manifest() -> list[dict]:
    script = (
        "import { ITEMS } from './src/data/items.js';"
        "import { EXACT_ITEM_ICON_KEYS, SPECIAL_ITEM_ICON_KEYS, getEquipmentIllustrationFamilyKey } from './src/utils/itemVisuals.js';"
        "const equip=Object.values(ITEMS).flat().filter(i=>i&&['weapon','armor','shield'].includes(i.type)).map(i=>({"
        "name:i.name,type:i.type,tier:i.tier,elem:i.elem||'',hands:i.hands||0,subtype:i.subtype||'',"
        "family:getEquipmentIllustrationFamilyKey(i),assetKey:SPECIAL_ITEM_ICON_KEYS[i.name]||EXACT_ITEM_ICON_KEYS[i.name]||null}));"
        "console.log(JSON.stringify(equip,null,2));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    MANIFEST_PATH.write_text(result.stdout, encoding="utf-8")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def blend_channel(current: int, target: int, amount: float) -> int:
    return max(0, min(255, round(current * (1 - amount) + target * amount)))


def tint_image(image: Image.Image, entry: dict) -> Image.Image:
    palette = ELEMENT_PALETTES.get(entry.get("elem", ""), ELEMENT_PALETTES[""])
    name = entry["name"]
    tier = entry.get("tier", 1)

    accent = palette["accent"]
    shade = palette["shade"]
    if any(hint in name for hint in WOOD_HINTS):
        accent = (214, 180, 126)
        shade = (114, 81, 49)
    if any(hint in name for hint in RUST_HINTS):
        accent = (198, 140, 104)
        shade = (120, 73, 54)
    if any(hint in name for hint in HOLY_HINTS):
        accent = (255, 232, 182)
        shade = (177, 132, 56)
    if any(hint in name for hint in ARCANE_HINTS):
        accent = (193, 176, 255)
        shade = (88, 79, 154)
    if any(hint in name for hint in SHADOW_HINTS):
        accent = (171, 155, 255)
        shade = (71, 52, 134)
    if any(hint in name for hint in NATURE_HINTS):
        accent = (171, 230, 153)
        shade = (65, 121, 63)

    accent_mix = min(0.18 + tier * 0.02, 0.34)
    shade_mix = min(0.12 + tier * 0.015, 0.28)
    glow_mix = min(0.08 + tier * 0.01, 0.18)

    tinted = image.convert("RGBA")
    pixels = tinted.load()
    for y in range(tinted.height):
        for x in range(tinted.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            brightness = (r + g + b) / 765
            if brightness > 0.72:
                pixels[x, y] = (
                    blend_channel(r, accent[0], accent_mix),
                    blend_channel(g, accent[1], accent_mix),
                    blend_channel(b, accent[2], accent_mix),
                    a,
                )
            elif brightness > 0.34:
                pixels[x, y] = (
                    blend_channel(r, shade[0], shade_mix * 0.55),
                    blend_channel(g, shade[1], shade_mix * 0.55),
                    blend_channel(b, shade[2], shade_mix * 0.55),
                    a,
                )
            else:
                pixels[x, y] = (
                    blend_channel(r, shade[0], shade_mix),
                    blend_channel(g, shade[1], shade_mix),
                    blend_channel(b, shade[2], shade_mix),
                    a,
                )
            if tier >= 4 and brightness > 0.8:
                rr, gg, bb, aa = pixels[x, y]
                pixels[x, y] = (
                    blend_channel(rr, 255, glow_mix),
                    blend_channel(gg, 248, glow_mix),
                    blend_channel(bb, 222, glow_mix),
                    aa,
                )
    return tinted


def draw_border_glow(canvas: Image.Image, entry: dict) -> None:
    tier = entry.get("tier", 1)
    glow = TIER_GLOWS.get(tier, TIER_GLOWS[1])
    if glow[3] <= 0:
        return
    draw = ImageDraw.Draw(canvas)
    for inset, alpha in ((5, glow[3]), (8, max(0, glow[3] - 24))):
        draw.rounded_rectangle(
            (inset, inset, canvas.width - inset, canvas.height - inset),
            radius=22,
            outline=(glow[0], glow[1], glow[2], alpha),
            width=2,
        )


def trim_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def fit_on_canvas(image: Image.Image, canvas_size: tuple[int, int], box: tuple[int, int, int, int]) -> Image.Image:
    x, y, width, height = box
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.NEAREST)
    paste_x = x + (width - copy.width) // 2
    paste_y = y + (height - copy.height) // 2
    canvas.alpha_composite(copy, (paste_x, paste_y))
    return canvas


def compose_exact_asset(entry: dict) -> Image.Image:
    family_path = FAMILY_DIR / f"{entry['family']}.png"
    if family_path.exists():
        base = Image.open(family_path).convert("RGBA")
        tinted = tint_image(trim_alpha(base), entry)
        centered = fit_on_canvas(tinted, CANVAS_SIZE, (16, 16, 128, 128))
        canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        canvas.alpha_composite(centered)
        draw_border_glow(canvas, entry)
        return canvas

    wearable_family = get_wearable_family(entry)
    if wearable_family and (WEARABLE_FAMILY_DIR / f"{wearable_family}.png").exists():
        base = Image.open(WEARABLE_FAMILY_DIR / f"{wearable_family}.png").convert("RGBA")
        tinted = tint_image(base, entry)
        centered = fit_on_canvas(trim_alpha(tinted), CANVAS_SIZE, (18, 16, 124, 124))
        canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        canvas.alpha_composite(centered)
        draw_border_glow(canvas, entry)
        return canvas

    return Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))


def get_wearable_family(entry: dict) -> str | None:
    family = entry.get("family") or ""
    if (
        family.startswith("weapon-")
        or family.startswith("offhand-")
        or family.startswith("headgear-")
        or family.startswith("armor-")
    ):
        return family
    return None


def compose_exact_wearable_asset(entry: dict) -> Image.Image | None:
    wearable_family = get_wearable_family(entry)
    if not wearable_family:
        return None

    source_path = WEARABLE_FAMILY_DIR / f"{wearable_family}.png"
    if not source_path.exists():
        return None

    base = Image.open(source_path).convert("RGBA")
    tinted = tint_image(base, entry)
    return fit_on_canvas(trim_alpha(tinted), WEARABLE_CANVAS, (8, 8, 56, 56))


def write_contact_sheet(entries: list[dict]) -> None:
    columns = 4
    rows = math.ceil(len(entries) / columns)
    sheet = Image.new("RGBA", (columns * 200, rows * 220), (8, 11, 18, 255))
    draw = ImageDraw.Draw(sheet)

    for index, entry in enumerate(entries):
        source = Image.open(OUTPUT_DIR / f"{entry['assetKey']}.png").convert("RGBA")
        row = index // columns
        col = index % columns
        x = col * 200
        y = row * 220
        sheet.alpha_composite(source.resize((144, 144), Image.Resampling.NEAREST), (x + 28, y + 16))
        draw.text((x + 12, y + 170), entry["name"], fill=(240, 240, 240, 255))
        draw.text((x + 12, y + 190), entry["family"], fill=(157, 168, 190, 255))

    sheet.save(ARTIFACT_DIR / "contact-sheet.png")


def write_wearable_contact_sheet(entries: list[dict]) -> None:
    preview_base = Image.open(BASE_PREVIEW_AVATAR).convert("RGBA")
    columns = 4
    rows = math.ceil(len(entries) / columns)
    sheet = Image.new("RGBA", (columns * 200, rows * 220), (8, 11, 18, 255))
    draw = ImageDraw.Draw(sheet)

    for index, entry in enumerate(entries):
        source = Image.open(WEARABLE_OUTPUT_DIR / f"{entry['assetKey']}.png").convert("RGBA")
        composite = preview_base.copy()
        composite.alpha_composite(source)
        preview = composite.resize((116, 176), Image.Resampling.NEAREST)
        row = index // columns
        col = index % columns
        x = col * 200
        y = row * 220
        tile = Image.new("RGBA", (200, 220), (14, 19, 27, 255))
        tile.alpha_composite(preview, (42, 8))
        tile_draw = ImageDraw.Draw(tile)
        tile_draw.text((12, 186), entry["name"], fill=(240, 240, 240, 255))
        tile_draw.text((12, 204), entry["family"], fill=(157, 168, 190, 255))
        sheet.alpha_composite(tile, (x, y))

    sheet.save(WEARABLE_ARTIFACT_DIR / "contact-sheet.png")


def main() -> None:
    ensure_dirs()
    entries = [entry for entry in load_manifest() if entry.get("assetKey") and entry.get("family")]
    manifest_out = []
    wearable_manifest_out = []
    wearable_entries = []

    for entry in entries:
        image = compose_exact_asset(entry)
        out_path = OUTPUT_DIR / f"{entry['assetKey']}.png"
        image.save(out_path)
        manifest_out.append(
            {
                "name": entry["name"],
                "family": entry["family"],
                "assetKey": entry["assetKey"],
                "path": str(out_path.relative_to(REPO_ROOT)),
            }
        )

        wearable = compose_exact_wearable_asset(entry)
        if wearable is not None:
            wearable_path = WEARABLE_OUTPUT_DIR / f"{entry['assetKey']}.png"
            wearable.save(wearable_path)
            wearable_entries.append(entry)
            wearable_manifest_out.append(
                {
                    "name": entry["name"],
                    "family": entry["family"],
                    "assetKey": entry["assetKey"],
                    "path": str(wearable_path.relative_to(REPO_ROOT)),
                }
            )

    write_contact_sheet(entries)
    (ARTIFACT_DIR / "manifest.json").write_text(json.dumps(manifest_out, ensure_ascii=False, indent=2), encoding="utf-8")
    write_wearable_contact_sheet(wearable_entries)
    (WEARABLE_ARTIFACT_DIR / "manifest.json").write_text(json.dumps(wearable_manifest_out, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
