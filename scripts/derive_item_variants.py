#!/usr/bin/env python3
"""
derive_item_variants.py

consumable(hp/mp/cure/buff) / mat / key / all(relic) 아이템들의 chibi-style PNG를
public/assets/items/의 chibi base 자산에서 PIL tint+variation으로 파생.

기존: 각 아이템마다 procedural rect SVG (item-consumable-NNN.svg 등) — 결 안 맞음
신규: 같은 위치에 chibi 결 PNG 저장 → itemVisuals.js extension 로직이 PNG 우선 로드

Base 매핑:
  - hp/mp/cure/buff → potion.png + hue-rotate per type
  - mat (재료) → 이름 hint별 base 자동 매핑 (ore/crystal/scale/bone/herb/...)
  - key → key.png + hue-rotate per name
  - all (relic) → relic.png + hue-rotate per name

usage:
  python3 scripts/derive_item_variants.py
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageEnhance
import colorsys

REPO_ROOT = Path(__file__).resolve().parent.parent
ITEMS_DIR = REPO_ROOT / "public" / "assets" / "items"
OUTPUT_INDEX = REPO_ROOT / "output" / "derived-item-variants.json"


# -- Type별 default base + tint --
TYPE_BASES = {
    "hp":   {"base": "potion.png",   "default_tint": {"hue":   0, "sat": 1.20, "bright": 1.05}},  # 빨강 그대로
    "mp":   {"base": "potion.png",   "default_tint": {"hue": 200, "sat": 1.30, "bright": 1.05}},  # 빨강→파랑
    "cure": {"base": "potion.png",   "default_tint": {"hue":  90, "sat": 1.20, "bright": 1.10}},  # 빨강→녹색
    "buff": {"base": "potion.png",   "default_tint": {"hue":  60, "sat": 1.30, "bright": 1.15}},  # 빨강→황금
    "mat":  {"base": "material.png", "default_tint": None},
    "key":  {"base": "key.png",      "default_tint": None},
    "all":  {"base": "relic.png",    "default_tint": None},
}

# mat 안에서 이름 hint로 base 분기
MAT_BASE_RULES = [
    (re.compile(r"광석|광물|ore"),                 "ore.png"),
    (re.compile(r"결정|크리스탈|crystal"),          "crystal.png"),
    (re.compile(r"비늘|scale"),                    "scale.png"),
    (re.compile(r"송곳니|독니|fang"),              "fang.png"),
    (re.compile(r"뼈|bone"),                       "bone.png"),
    (re.compile(r"약초|허브|풀|꽃|herb"),          "herb.png"),
    (re.compile(r"핵|코어|core"),                   "core.png"),
    (re.compile(r"각인석|봉인석|relic"),            "relic.png"),
    (re.compile(r"주머니|동전|pouch"),              "pouch.png"),
    (re.compile(r"강화\s*재료|돌|광물질"),          "material.png"),
]


def pick_mat_base(name: str) -> str:
    for pat, base in MAT_BASE_RULES:
        if pat.search(name):
            return base
    return "material.png"


# 이름 hint별 색감 시프트 (cycle 38/39와 동일 룰)
HINT_FILTERS = {
    "rust":     {"hue":  -20, "sat": 1.25, "bright": 0.85},
    "holy":     {"hue":  +35, "sat": 1.30, "bright": 1.15},
    "arcane":   {"hue": +180, "sat": 1.20, "bright": 1.00},
    "shadow":   {"hue": +110, "sat": 1.10, "bright": 0.78},
    "nature":   {"hue": +100, "sat": 1.20, "bright": 1.00},
    "dragon":   {"hue":  -30, "sat": 1.40, "bright": 0.95},
    "ice":      {"hue": +180, "sat": 1.20, "bright": 1.10},
    "fire":     {"hue":  -10, "sat": 1.40, "bright": 1.10},
    "wind":     {"hue":  +90, "sat": 1.10, "bright": 1.05},
    "celestial":{"hue":  +50, "sat": 1.30, "bright": 1.20},
    "void":     {"hue": +260, "sat": 1.15, "bright": 0.85},
}

NAME_HINT_PATTERNS = [
    ("rust",      re.compile(r"녹슨|낡은|허름")),
    ("holy",      re.compile(r"성광|천공|천상|팔라딘|심판|성|광")),
    ("arcane",    re.compile(r"마법|마도|아크|에테르|차원|룬|그리모어|현자")),
    ("shadow",    re.compile(r"암흑|어둠|심연|혼돈|그림자|죽음|마왕|타락")),
    ("void",      re.compile(r"공허|허공|보이드")),
    ("nature",    re.compile(r"세계수|숲|엘프|레인저|자연|녹음|뿌리")),
    ("dragon",    re.compile(r"용|드래곤")),
    ("ice",       re.compile(r"얼음|빙결|서리|빙|동결|청해|심해")),
    ("fire",      re.compile(r"불꽃|화염|용암|불사조|폭염|작열")),
    ("wind",      re.compile(r"바람|폭풍|풍")),
    ("celestial", re.compile(r"별|성좌|유성|원시")),
]


def pick_hint(name: str) -> str | None:
    for hint, pat in NAME_HINT_PATTERNS:
        if pat.search(name):
            return hint
    return None


def tint_image(img: Image.Image, hue_deg: int, sat_mult: float, bright_mult: float) -> Image.Image:
    img = img.convert("RGBA").copy()
    pixels = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            hh = (hh + hue_deg / 360.0) % 1.0
            ss = max(0.0, min(1.0, ss * sat_mult))
            ll = max(0.0, min(1.0, ll * bright_mult))
            r2, g2, b2 = colorsys.hls_to_rgb(hh, ll, ss)
            pixels[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return img


def apply_tier(img: Image.Image, tier: int) -> Image.Image:
    if tier and tier >= 4:
        img = ImageEnhance.Color(img).enhance(1.12)
        img = ImageEnhance.Brightness(img).enhance(1.05)
    if tier and tier >= 5:
        img = ImageEnhance.Contrast(img).enhance(1.10)
    return img


def derive_one(item_type: str, name: str, tier: int) -> Image.Image | None:
    cfg = TYPE_BASES.get(item_type)
    if not cfg:
        return None

    if item_type == "mat":
        base_name = pick_mat_base(name)
    else:
        base_name = cfg["base"]

    base_path = ITEMS_DIR / base_name
    if not base_path.exists():
        return None

    img = Image.open(base_path).convert("RGBA")

    # 1차: 이름 hint 우선
    hint = pick_hint(name)
    if hint and hint in HINT_FILTERS:
        f = HINT_FILTERS[hint]
        img = tint_image(img, f["hue"], f["sat"], f["bright"])
    # 2차: type별 default tint (hp/mp/cure/buff potion 색감 시프트)
    elif cfg.get("default_tint"):
        f = cfg["default_tint"]
        img = tint_image(img, f["hue"], f["sat"], f["bright"])

    img = apply_tier(img, tier)
    return img


def collect_targets() -> list[dict]:
    """모든 type의 mat/key/hp/mp/cure/buff/all 아이템 + EXACT 매핑된 키 반환."""
    script = (
        "import('./src/utils/itemVisuals.js').then(m => {"
        "import('./src/data/items.js').then(items => {"
        "const all = Object.values(items.ITEMS).flat()"
        ".filter(i=>i&&['hp','mp','cure','buff','mat','key','all'].includes(i.type));"
        "const targets = [];"
        "for (const it of all) {"
        "  const k = m.EXACT_ITEM_ICON_KEYS[it.name] || m.SPECIAL_ITEM_ICON_KEYS[it.name];"
        "  if (!k || k.startsWith('named-')) continue;"
        "  targets.push({ key: k, name: it.name, type: it.type, tier: it.tier || 1 });"
        "}"
        "console.log(JSON.stringify(targets));"
        "});});"
    )
    res = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout.strip().splitlines()[-1])


def main() -> None:
    targets = collect_targets()
    print(f"=== 총 {len(targets)}개 derive 대상 ===\n")

    derived = []
    for entry in targets:
        out_img = derive_one(entry["type"], entry["name"], entry["tier"])
        if out_img is None:
            print(f"  ⚠️  skip {entry['key']} | {entry['name']} (base 없음 또는 type 미지원)")
            continue
        out_path = ITEMS_DIR / f"{entry['key']}.png"
        out_img.save(out_path)
        hint = pick_hint(entry["name"])
        derived.append({**entry, "hint": hint, "outputPath": str(out_path)})
        print(f"  ✓ {entry['key']:24} | {entry['name']:18} | type={entry['type']:5} hint={hint or '-':9} tier={entry['tier']}")

    OUTPUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_INDEX.write_text(json.dumps(derived, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총 {len(derived)}개 아이템 chibi PNG 생성")
    print(f"인덱스: {OUTPUT_INDEX}")


if __name__ == "__main__":
    main()
