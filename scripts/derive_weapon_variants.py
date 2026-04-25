#!/usr/bin/env python3
"""
derive_weapon_variants.py

기존 42개 imagegen chibi weapon PNG를 base로 사용해 누락된 weapon 아이템들의
PNG를 PIL tint+variation으로 파생 생성. armor/shield는 별도 처리 (base 없음).

전략:
  1. 각 누락 weapon의 shape(dagger/sword/staff/...)을 이름 hint로 추론
  2. 같은 shape의 imagegen base 중 가장 적합한 것 선택
  3. 이름 hint(rust/holy/arcane/shadow/nature/dragon/ice/fire 등) + tier로 tint
     (cycle 33 equipmentTint.js와 같은 룰)
  4. public/assets/equipment-exact/{key}.png로 저장
  5. IMAGEGEN_OVERLAY_KEYS에 자동 추가 (별도 deploy 스크립트로)

usage:
  python3 scripts/derive_weapon_variants.py
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageEnhance
import colorsys

REPO_ROOT = Path(__file__).resolve().parent.parent
EXACT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
OUTPUT_INDEX = REPO_ROOT / "output" / "derived-weapon-variants.json"


# -- shape inference (cycle 33의 equipmentTint.js와 일치) --
def infer_shape(name: str) -> str:
    if re.search(r"단검|단도|독아|송곳니", name): return "dagger"
    if "표창" in name: return "throwing-blade"
    if re.search(r"대검|양손검|그레이트소드|클레이모어|대도(?!끼)", name): return "greatsword"
    if re.search(r"대도끼|그레이트액스", name): return "greataxe"
    if re.search(r"검(?!\s*시)|소드|블레이드|칼날|칼", name): return "sword"
    if re.search(r"도끼|액스", name): return "axe"
    if re.search(r"해머|망치|메이스|철퇴", name): return "hammer"
    if "로드" in name: return "rod"
    if re.search(r"지팡이", name): return "staff"
    if re.search(r"완드|마법봉|봉", name): return "wand"
    if re.search(r"장궁|롱보우", name): return "longbow"
    if re.search(r"활|궁", name): return "bow"
    if re.search(r"창|랜스", name): return "spear"
    if re.search(r"낫|사이즈", name): return "scythe"
    if re.search(r"채찍|위프", name): return "whip"
    if "곤봉" in name: return "club"
    return "sword"


# -- 같은 shape의 imagegen base 중 가장 typical한 것 선택 --
# (간단한 매핑 — 첫 번째 등장 PNG를 사용)
SHAPE_BASES = {
    "dagger":         "item-weapon-001.png",  # 녹슨 단검
    "throwing-blade": "item-weapon-001.png",  # dagger와 같은 base 재사용
    "sword":          "item-weapon-002.png",  # 롱소드
    "greatsword":     "item-weapon-016.png",  # 양손검
    "axe":            "item-weapon-024.png",  # 전투도끼
    "greataxe":       "item-weapon-024.png",  # axe base 재사용 + tint
    "hammer":         "item-weapon-014.png",  # 낡은 철퇴
    "staff":          "item-weapon-003.png",  # 나무지팡이
    "rod":            "item-weapon-003.png",  # staff base 재사용
    "wand":           "item-weapon-006.png",  # 마법봉 (기존 imagegen)
    "bow":            "item-weapon-004.png",  # 단궁
    "longbow":        "item-weapon-066.png",  # 큰 활 (불사조 활 같은)
    "spear":          "item-weapon-022.png",  # 병사의 창
    "club":           "item-weapon-005.png",  # 나무곤봉
    "whip":           "item-weapon-005.png",  # club base 재사용 + tint
    "scythe":         "item-weapon-002.png",  # base 없음 — sword fallback
}


# -- tint table (equipmentTint.js와 동기) --
HINT_FILTERS = {
    "rust":   {"hue":  -20, "sat": 1.25, "bright": 0.85},
    "holy":   {"hue":  +35, "sat": 1.30, "bright": 1.15},
    "arcane": {"hue": +180, "sat": 1.20, "bright": 1.00},
    "shadow": {"hue": +110, "sat": 1.10, "bright": 0.78},  # toward purple
    "nature": {"hue": +100, "sat": 1.20, "bright": 1.00},
    "wood":   {"hue":  +20, "sat": 0.95, "bright": 0.95},
    "dragon": {"hue":  -30, "sat": 1.40, "bright": 0.95},  # red/orange
    "ice":    {"hue": +180, "sat": 1.20, "bright": 1.10},  # cyan
    "fire":   {"hue":  -10, "sat": 1.40, "bright": 1.10},
    "wind":   {"hue":  +90, "sat": 1.10, "bright": 1.05},
    "celestial": {"hue": +50, "sat": 1.30, "bright": 1.20},
}

NAME_HINT_PATTERNS = [
    ("rust",   re.compile(r"녹슨|낡은")),
    ("holy",   re.compile(r"성광|천공|천상|팔라딘|심판|성기사|성|광")),
    ("arcane", re.compile(r"마법|마도|아크|에테르|차원|룬|그리모어|현자|크리스탈|수정")),
    ("shadow", re.compile(r"암흑|어둠|심연|공허|혼돈|그림자|죽음|마왕")),
    ("nature", re.compile(r"세계수|숲|엘프|레인저|자연|사냥(?!꾼)|녹음")),
    ("wood",   re.compile(r"나무|목재")),
    ("dragon", re.compile(r"용|드래곤")),
    ("ice",    re.compile(r"얼음|빙결|서리|빙|동결|청해")),
    ("fire",   re.compile(r"불꽃|화염|용암|불사조|폭염|작열")),
    ("wind",   re.compile(r"바람|폭풍|허공")),
    ("celestial", re.compile(r"별|성좌|유성|천공의|천상의")),
]

def pick_hint(name: str) -> str | None:
    for hint, pat in NAME_HINT_PATTERNS:
        if pat.search(name):
            return hint
    return None


def tint_image(img: Image.Image, hue_deg: int, sat_mult: float, bright_mult: float) -> Image.Image:
    """Per-pixel hue/sat/bright shift in HLS space, alpha 보존."""
    img = img.convert("RGBA").copy()
    w, h = img.size
    pixels = img.load()
    for y in range(h):
        for x in range(w):
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

    # tier별 saturation/contrast 살짝 부스트 (T4+)
    if tier and tier >= 4:
        enh = ImageEnhance.Color(out).enhance(1.15)
        out = ImageEnhance.Brightness(enh).enhance(1.05)
    if tier and tier >= 5:
        out = ImageEnhance.Contrast(out).enhance(1.10)

    return out


def collect_missing_weapons() -> list[dict]:
    """node 헬퍼로 missing weapon 목록 추출."""
    script = (
        "import('./src/utils/itemVisuals.js').then(m => {"
        "import('./src/data/items.js').then(items => {"
        "const all = Object.values(items.ITEMS).flat()"
        ".filter(i=>i&&i.type==='weapon');"
        "const have = m.IMAGEGEN_OVERLAY_KEYS;"
        "const missing = [];"
        "for (const it of all) {"
        "  const k = m.EXACT_ITEM_ICON_KEYS[it.name] || m.SPECIAL_ITEM_ICON_KEYS[it.name];"
        "  if (!k || k.startsWith('named-') || have.has(k)) continue;"
        "  missing.push({ key: k, name: it.name, tier: it.tier || 1 });"
        "}"
        "console.log(JSON.stringify(missing));"
        "});});"
    )
    res = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout.strip().splitlines()[-1])


def main() -> None:
    missing = collect_missing_weapons()
    print(f"누락 weapon: {len(missing)}개")

    derived = []
    for entry in missing:
        name = entry["name"]
        key = entry["key"]
        tier = entry["tier"]
        shape = infer_shape(name)
        base_name = SHAPE_BASES.get(shape, "item-weapon-002.png")
        base_path = EXACT_DIR / base_name
        if not base_path.exists():
            print(f"  ⚠️  base 없음: {base_name} (skip {key} {name})")
            continue

        out_img = derive_variant(base_path, name, tier)
        out_path = EXACT_DIR / f"{key}.png"
        out_img.save(out_path)

        hint = pick_hint(name)
        derived.append({
            "key": key, "name": name, "shape": shape, "base": base_name,
            "hint": hint, "tier": tier,
        })
        print(f"  ✓ {key} | {name:24} | shape={shape:14} base={base_name} hint={hint or '-'} tier={tier}")

    OUTPUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_INDEX.write_text(json.dumps(derived, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과: {len(derived)}개 weapon variant 생성")
    print(f"인덱스: {OUTPUT_INDEX}")


if __name__ == "__main__":
    main()
