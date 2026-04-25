#!/usr/bin/env python3
"""
polish_armor_shield_assets.py

armor/shield는 imagegen base가 없어서 derive 불가. 대신 procedural 5색
PNG를 PIL로 후처리해서 chibi 결과 비슷한 느낌으로 polish:
  - 이름 hint별 hue/sat/bright tint (cycle 33 룰)
  - 약간의 brightness/contrast boost (chibi feel)
  - 옅은 outer glow (T3+에서 강도 증가, cycle 34와 일관)

완벽한 chibi base 자산이 아닌 근사 polish이지만, procedural 그대로보다
캐릭터 결과 가까워짐. 인벤토리 슬롯에 보일 때 시각 일관성 향상.

usage:
  python3 scripts/polish_armor_shield_assets.py
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import colorsys

REPO_ROOT = Path(__file__).resolve().parent.parent
EXACT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
OUTPUT_INDEX = REPO_ROOT / "output" / "polished-armor-shield.json"


HINT_FILTERS = {
    "rust":   {"hue":  -20, "sat": 1.25, "bright": 0.85, "glow": "#d97a3a"},
    "holy":   {"hue":  +35, "sat": 1.30, "bright": 1.15, "glow": "#f6d878"},
    "arcane": {"hue": +180, "sat": 1.20, "bright": 1.00, "glow": "#9b8aff"},
    "shadow": {"hue": +110, "sat": 1.10, "bright": 0.78, "glow": "#7a4fc4"},
    "nature": {"hue": +100, "sat": 1.20, "bright": 1.00, "glow": "#7ad48a"},
    "dragon": {"hue":  -30, "sat": 1.40, "bright": 0.95, "glow": "#d65c3a"},
    "ice":    {"hue": +180, "sat": 1.20, "bright": 1.10, "glow": "#7ec8e3"},
    "fire":   {"hue":  -10, "sat": 1.40, "bright": 1.10, "glow": "#ff8c4a"},
    "wind":   {"hue":  +90, "sat": 1.10, "bright": 1.05, "glow": "#a8e0b4"},
    "celestial": {"hue": +50, "sat": 1.30, "bright": 1.20, "glow": "#f6d8b0"},
    "leather":{"hue":  +10, "sat": 1.05, "bright": 0.95, "glow": None},
    "plate":  {"hue":   +0, "sat": 0.95, "bright": 1.05, "glow": "#bfd4f0"},
    "cloth":  {"hue":  +20, "sat": 1.05, "bright": 1.00, "glow": None},
}

NAME_HINT_PATTERNS = [
    ("rust",     re.compile(r"녹슨|낡은|허름")),
    ("holy",     re.compile(r"성광|천공|천상|팔라딘|심판|성기사|성수|성")),
    ("arcane",   re.compile(r"마법|마도|아크|에테르|차원|룬|그리모어|현자|크리스탈|수정")),
    ("shadow",   re.compile(r"암흑|어둠|심연|공허|혼돈|그림자|죽음|마왕")),
    ("nature",   re.compile(r"세계수|숲|엘프|레인저|자연|녹음|드루이드")),
    ("dragon",   re.compile(r"용|드래곤")),
    ("ice",      re.compile(r"얼음|빙결|서리|빙|동결|청해|심해")),
    ("fire",     re.compile(r"불꽃|화염|용암|불사조|폭염|작열|화")),
    ("wind",     re.compile(r"바람|폭풍|허공|풍")),
    ("celestial",re.compile(r"별|성좌|유성")),
    ("leather",  re.compile(r"가죽|경갑|레더")),
    ("plate",    re.compile(r"판금|중갑|풀플레이트|갑주|갑옷|흉갑")),
    ("cloth",    re.compile(r"로브|예복|성의|튜닉|복")),
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


def add_glow(img: Image.Image, glow_hex: str, radius: float) -> Image.Image:
    """Painterly outer glow approximation."""
    base = img.convert("RGBA")
    glow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gpx = glow_layer.load()
    bpx = base.load()
    gr = int(glow_hex[1:3], 16)
    gg = int(glow_hex[3:5], 16)
    gb = int(glow_hex[5:7], 16)
    for y in range(base.height):
        for x in range(base.width):
            if bpx[x, y][3] > 30:
                gpx[x, y] = (gr, gg, gb, 130)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius))
    combined = Image.alpha_composite(glow_layer, base)
    return combined


def polish_one(src_path: Path, name: str, tier: int) -> Image.Image:
    img = Image.open(src_path).convert("RGBA")
    hint = pick_hint(name)
    if hint and hint in HINT_FILTERS:
        f = HINT_FILTERS[hint]
        img = tint_image(img, f["hue"], f["sat"], f["bright"])
    # 약간의 chibi-feel polish
    img = ImageEnhance.Color(img).enhance(1.18)
    img = ImageEnhance.Brightness(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.10)
    # tier glow (T3+)
    if tier and tier >= 3 and hint and HINT_FILTERS.get(hint, {}).get("glow"):
        glow_radius = 1.5 + (tier - 3) * 0.8
        img = add_glow(img, HINT_FILTERS[hint]["glow"], glow_radius)
    return img


def collect_targets(item_type: str) -> list[dict]:
    script = (
        "import('./src/utils/itemVisuals.js').then(m => {"
        "import('./src/data/items.js').then(items => {"
        f"const all = Object.values(items.ITEMS).flat()"
        f".filter(i=>i&&i.type==='{item_type}');"
        "const have = m.IMAGEGEN_OVERLAY_KEYS;"
        "const targets = [];"
        "for (const it of all) {"
        "  const k = m.EXACT_ITEM_ICON_KEYS[it.name] || m.SPECIAL_ITEM_ICON_KEYS[it.name];"
        "  if (!k || k.startsWith('named-') || have.has(k)) continue;"
        "  targets.push({ key: k, name: it.name, tier: it.tier || 1 });"
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
    polished = []
    for item_type in ["armor", "shield"]:
        targets = collect_targets(item_type)
        print(f"\n=== {item_type}: {len(targets)}개 polish ===")
        for entry in targets:
            key = entry["key"]
            name = entry["name"]
            tier = entry["tier"]
            src_path = EXACT_DIR / f"{key}.png"
            if not src_path.exists():
                print(f"  ⚠️  source 없음: {key}")
                continue
            out_img = polish_one(src_path, name, tier)
            out_img.save(src_path)  # 같은 위치에 덮어쓰기
            hint = pick_hint(name)
            polished.append({"key": key, "name": name, "type": item_type, "tier": tier, "hint": hint})
            print(f"  ✓ {key} | {name:20} | hint={hint or '-'} tier={tier}")

    OUTPUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_INDEX.write_text(json.dumps(polished, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총 {len(polished)}개 armor/shield polish 완료")
    print(f"인덱스: {OUTPUT_INDEX}")


if __name__ == "__main__":
    main()
