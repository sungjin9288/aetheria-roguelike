"""Slice 26: 일반 장비 전수(~229종) 아이템별 고유 픽셀 아트 생성.

문제: 일반 장비 229종이 family PNG 22장을 공유 — '수련생의 검'과
'강철 롱소드'가 완전히 같은 그림이라 상점/인벤이 미완성처럼 보였다.

기법 (시그니처 생성기와 동일 엔진):
- base = 해당 아이템의 family 실루엣 (등급/타입 인지 가능성 유지)
- 톤 = elem → artPalette tone (화염→fire, 빛→holy ...), 무속성은 tier 사다리
  (1 rust → 2-3 steel → 4 earth → 5 holy → 6 arcane)
- 이름 시드 결정론 jitter(hue ±0.05, sat ±) — 같은 톤·실루엣끼리도 구분
- tier 4+ 스파클, 5+ 옅은 오라 — 상위 티어 신호 (시그니처 오라보다 약하게)

출력: public/assets/equipment-exact/auto/auto-<sha1 12>.png +
src/data/equipmentArtManifest.json (이름 → 경로 매니페스트, itemVisuals가 읽음).

입력 카탈로그는 node로 덤프:
  node --import tsx scripts/dump-equipment-catalog.mjs  (또는 /tmp 경유)
"""
from __future__ import annotations

import colorsys
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_signature_pixel_art import (  # noqa: E402
    add_aura,
    add_sparkles,
    load_palettes,
    seed_rng,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
FAMILY_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "items"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact" / "auto"
MANIFEST = REPO_ROOT / "src" / "data" / "equipmentArtManifest.json"
CATALOG = Path("/tmp/equipment-catalog.json")

CANVAS = 160

TONE_BY_ELEM = {
    "화염": "fire",
    "냉기": "frost",
    "어둠": "shadow",
    "빛": "holy",
    "자연": "nature",
    "대지": "earth",
    "바람": "nature",
    "에테르": "arcane",
}

TONE_BY_TIER = {1: "rust", 2: "steel", 3: "steel", 4: "earth", 5: "holy", 6: "arcane"}


def jittered_hue_shift(image: Image.Image, target_rgb, rng) -> Image.Image:
    """시그니처 hue_shift와 동일 3분기 + 이름 시드 jitter."""
    th, ts, tv = colorsys.rgb_to_hsv(*(c / 255.0 for c in target_rgb))
    th = (th + (rng() - 0.5) * 0.1) % 1.0
    sat_scale = 0.9 + rng() * 0.3
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if s > 0.08:
                dh = ((th - h + 0.5) % 1.0) - 0.5
                nh = (h + dh * 0.9) % 1.0
                ns = min(1.0, (s * 0.82 + ts * 0.3) * sat_scale)
                nv = v
            elif v > 0.35:
                nh = th
                ns = min(1.0, ts * 0.4 * v * sat_scale)
                nv = v
            else:
                nh, ns, nv = h, s, v
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def art_slug(name: str) -> str:
    return "auto-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]


def build_item(entry: dict, palettes) -> Image.Image:
    base = Image.open(FAMILY_DIR / f"{entry['familyKey']}.png").convert("RGBA")
    bbox = base.getchannel("A").getbbox()
    if bbox:
        base = base.crop(bbox)

    tier = int(entry.get("tier") or 1)
    tone_key = TONE_BY_ELEM.get(entry.get("elem") or "", TONE_BY_TIER.get(tier, "steel"))
    tone = palettes[tone_key]
    rng = seed_rng(entry["name"])

    sprite = jittered_hue_shift(base, tone["mid"], rng)
    sprite.thumbnail((132, 132), Image.NEAREST)
    pos = ((CANVAS - sprite.width) // 2, (CANVAS - sprite.height) // 2)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    if tier >= 5:
        add_aura(canvas, sprite, pos, tone["trim"])
    canvas.alpha_composite(sprite, pos)
    if tier >= 4:
        add_sparkles(canvas, rng, tone["trim"], count=min(4, tier - 2))
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
        "$comment": "slice 26: 장비 아이템별 고유 아트 매니페스트 — scripts/generate_equipment_item_art.py가 생성. 수동 편집 금지.",
        "version": 1,
        "entries": dict(sorted(entries.items())),
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(entries)} item arts generated → {OUTPUT_DIR}")
    print(f"manifest → {MANIFEST}")


if __name__ == "__main__":
    main()
