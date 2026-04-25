#!/usr/bin/env python3
"""
derive_armor_shield_variants.py

public/assets/items/의 chibi 결 일반 base 자산 (armor/robe/cloak/boots/shield/book)을
사용해 armor/shield 64+16개 아이템의 chibi-style PNG를 PIL tint+variation으로 파생.

전략 (cycle 38 weapon variant와 동일):
  1. 이름 hint로 armor/shield의 sub-type 추론
     (갑주/로브/외투/장화/모자... 또는 방패/마도서)
  2. 같은 sub-type의 chibi base PNG를 source로 선택
  3. 이름 hint(rust/holy/arcane/shadow/...) + tier로 tint
  4. public/assets/equipment-exact/{key}.png로 저장 (덮어쓰기)
  5. IMAGEGEN_OVERLAY_KEYS에 자동 추가 (별도 단계)

모자/투구/후드는 chibi base 없음 → cloak.png를 약식 fallback으로 사용 (조잡할 수 있음).
사용자가 imagegen으로 모자/투구 base 만들면 SUBTYPE_BASES만 교체하면 됨.
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
EXACT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
OUTPUT_INDEX = REPO_ROOT / "output" / "derived-armor-shield-variants.json"


def infer_armor_subtype(name: str) -> str:
    if re.search(r"로브|예복|성의|가운", name): return "robe"
    if re.search(r"부츠|장화|신발", name): return "boots"
    if re.search(r"모자|후드|투구|머리띠|가면|마스크|쓰개|관|왕관|안대", name): return "headgear"
    if re.search(r"외투|망토|클로크|튜닉|복(?!\s)|코트|가죽 조끼", name): return "cloak"
    # 갑주/플레이트/판금/흉갑/갑옷/메일/풀플레이트/슈트
    return "armor"


def infer_shield_subtype(name: str) -> str:
    if re.search(r"마도서|주문서|그리모어|서판|책|북|bestiary|tome|코덱스", name): return "book"
    return "shield"


# 매핑 - public/assets/items/{name}.png를 base로 사용
ARMOR_BASES = {
    "armor":    "armor.png",
    "robe":     "robe.png",
    "cloak":    "cloak.png",
    "boots":    "boots.png",
    "headgear": "cloak.png",  # 정확한 base 없음 — 임시. 추후 imagegen으로 교체.
}

SHIELD_BASES = {
    "shield": "shield.png",
    "book":   "book.png",
}

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
    "leather":  {"hue":  +12, "sat": 1.10, "bright": 0.92},
    "plate":    {"hue":   -5, "sat": 0.92, "bright": 1.05},
    "void":     {"hue": +260, "sat": 1.15, "bright": 0.85},
}

NAME_HINT_PATTERNS = [
    ("rust",     re.compile(r"녹슨|낡은|허름")),
    ("holy",     re.compile(r"성광|천공|천상|팔라딘|심판|성기사|성수|성단|성|광")),
    ("arcane",   re.compile(r"마법|마도|아크|에테르|차원|룬|그리모어|현자|크리스탈|수정|시간")),
    ("shadow",   re.compile(r"암흑|어둠|심연|혼돈|그림자|죽음|마왕|타락")),
    ("void",     re.compile(r"공허|허공|보이드")),
    ("nature",   re.compile(r"세계수|숲|엘프|레인저|자연|녹음|드루이드|뿌리")),
    ("dragon",   re.compile(r"용|드래곤")),
    ("ice",      re.compile(r"얼음|빙결|서리|빙|동결|청해|심해")),
    ("fire",     re.compile(r"불꽃|화염|용암|불사조|폭염|작열|화염의")),
    ("wind",     re.compile(r"바람|폭풍|풍의")),
    ("celestial",re.compile(r"별|성좌|유성|천상|운명|원시")),
    ("leather",  re.compile(r"가죽|경갑|레더")),
    ("plate",    re.compile(r"판금|중갑|풀플레이트|갑주|흉갑|중장")),
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


def derive_variant(base_path: Path, name: str, tier: int) -> Image.Image:
    base = Image.open(base_path).convert("RGBA")
    hint = pick_hint(name)
    if hint and hint in HINT_FILTERS:
        f = HINT_FILTERS[hint]
        out = tint_image(base, f["hue"], f["sat"], f["bright"])
    else:
        out = base.copy()

    if tier and tier >= 4:
        out = ImageEnhance.Color(out).enhance(1.15)
        out = ImageEnhance.Brightness(out).enhance(1.05)
    if tier and tier >= 5:
        out = ImageEnhance.Contrast(out).enhance(1.10)
    return out


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
    derived = []

    # ARMOR (headgear는 chibi base 없어 skip — procedural 폴백 유지)
    armor_targets = collect_targets("armor")
    print(f"=== armor: {len(armor_targets)}개 derive (headgear skip) ===")
    skipped_headgear = []
    for entry in armor_targets:
        name = entry["name"]
        key = entry["key"]
        tier = entry["tier"]
        sub = infer_armor_subtype(name)
        if sub == "headgear":
            skipped_headgear.append(key)
            continue
        base_name = ARMOR_BASES.get(sub, "armor.png")
        base_path = ITEMS_DIR / base_name
        if not base_path.exists():
            print(f"  ⚠️  base 없음: {base_name}")
            continue
        out_img = derive_variant(base_path, name, tier)
        out_path = EXACT_DIR / f"{key}.png"
        out_img.save(out_path)
        hint = pick_hint(name)
        derived.append({"key": key, "name": name, "type": "armor", "subtype": sub,
                        "base": base_name, "hint": hint, "tier": tier})
        print(f"  ✓ {key} | {name:24} | sub={sub:8} base={base_name:12} hint={hint or '-'} tier={tier}")
    if skipped_headgear:
        print(f"\n  → headgear {len(skipped_headgear)}개 skip (chibi base 없음): {', '.join(skipped_headgear[:5])}{'...' if len(skipped_headgear) > 5 else ''}")

    # SHIELD
    shield_targets = collect_targets("shield")
    print(f"\n=== shield: {len(shield_targets)}개 derive ===")
    for entry in shield_targets:
        name = entry["name"]
        key = entry["key"]
        tier = entry["tier"]
        sub = infer_shield_subtype(name)
        base_name = SHIELD_BASES.get(sub, "shield.png")
        base_path = ITEMS_DIR / base_name
        if not base_path.exists():
            print(f"  ⚠️  base 없음: {base_name}")
            continue
        out_img = derive_variant(base_path, name, tier)
        out_path = EXACT_DIR / f"{key}.png"
        out_img.save(out_path)
        hint = pick_hint(name)
        derived.append({"key": key, "name": name, "type": "shield", "subtype": sub,
                        "base": base_name, "hint": hint, "tier": tier})
        print(f"  ✓ {key} | {name:24} | sub={sub:8} base={base_name:12} hint={hint or '-'} tier={tier}")

    OUTPUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_INDEX.write_text(json.dumps(derived, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총 {len(derived)}개 armor/shield variant 생성")
    print(f"인덱스: {OUTPUT_INDEX}")


if __name__ == "__main__":
    main()
