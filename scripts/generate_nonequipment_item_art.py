"""Slice 27: 비장비(소모품/재료/열쇠) 77종 아이템별 고유 픽셀 아트 생성.

문제: 물약 14종이 전부 같은 빨간 potion.png — 마나 물약도 빨간 병.
재료도 family 12장 공유 (crystal 12종 동일 그림 등).

기법 (slice 25/26 엔진 재사용):
- 소모품은 TYPE 기반 톤: hp→fire(적), mp→frost(청), cure→nature(녹),
  buff→holy(금) — 기능이 색으로 즉시 읽힌다.
- 재료(mat/key/all)는 self-jitter: 원본 고유색을 유지한 채 이름 시드로
  hue/sat 미세 변주 — 같은 family끼리도 구분.
- tier 3+ 스파클, 5+ 오라 (엘릭서급 신호).

출력: public/assets/items/auto/auto-<sha1 12>.png +
src/data/consumableArtManifest.json.
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_signature_pixel_art import add_aura, add_sparkles, load_palettes, seed_rng  # noqa: E402
from generate_equipment_item_art import art_slug, jittered_hue_shift  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "public" / "assets" / "items"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "items" / "auto"
MANIFEST = REPO_ROOT / "src" / "data" / "consumableArtManifest.json"
CATALOG = Path("/tmp/nonequip-catalog.json")

CANVAS = 160

TONE_BY_TYPE = {
    "hp": "fire",
    "mp": "frost",
    "cure": "nature",
    "buff": "holy",
}


def self_jitter(image: Image.Image, rng) -> Image.Image:
    """원본 고유색 유지 + 이름 시드 hue/sat 미세 변주 (재료 차별화)."""
    dh = (rng() - 0.5) * 0.14
    sat_scale = 0.85 + rng() * 0.4
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if s > 0.08:
                nr, ng, nb = colorsys.hsv_to_rgb((h + dh) % 1.0, min(1.0, s * sat_scale), v)
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def build_item(entry: dict, palettes) -> Image.Image:
    base = Image.open(SOURCE_DIR / f"{entry['familyKey']}.png").convert("RGBA")
    bbox = base.getchannel("A").getbbox()
    if bbox:
        base = base.crop(bbox)

    tier = int(entry.get("tier") or 1)
    rng = seed_rng(entry["name"])
    tone_key = TONE_BY_TYPE.get(entry.get("type") or "")

    if tone_key:
        tone = palettes[tone_key]
        sprite = jittered_hue_shift(base, tone["mid"], rng)
        accent = tone["trim"]
    else:
        sprite = self_jitter(base, rng)
        accent = (235, 226, 188)  # 중립 하이라이트

    sprite.thumbnail((118, 118), Image.NEAREST)
    pos = ((CANVAS - sprite.width) // 2, (CANVAS - sprite.height) // 2)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    if tier >= 5:
        add_aura(canvas, sprite, pos, accent)
    canvas.alpha_composite(sprite, pos)
    if tier >= 3:
        add_sparkles(canvas, rng, accent, count=min(4, tier - 1))
    return canvas


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    palettes = load_palettes()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    entries: dict[str, str] = {}
    for entry in catalog:
        slug = art_slug(entry["name"])
        image = build_item(entry, palettes)
        image.save(OUTPUT_DIR / f"{slug}.png")
        entries[entry["name"]] = f"auto/{slug}"

    manifest = {
        "$comment": "slice 27: 비장비 아이템별 고유 아트 매니페스트 — scripts/generate_nonequipment_item_art.py가 생성. 수동 편집 금지.",
        "version": 1,
        "entries": dict(sorted(entries.items())),
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(entries)} non-equipment arts generated → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
