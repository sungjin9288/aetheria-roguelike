#!/usr/bin/env python3
"""
bootstrap_layered_from_existing.py

cycle 47 layered character system을 위한 자산을 기존 자산에서 자동 도출.
imagegen 도구가 환경에 없으므로 가능한 best-effort:

  - body: adventurer.png 등 weaponless 직업 sprite를 body layer로 카피
  - weapon: output/imagegen/all-item-exact-icons/의 기존 chibi weapon PNG를
    family별 대표 1개씩 weapon layer로 카피 (size/anchor 맞추기)
  - armor: public/assets/items/의 chibi armor/robe/cloak PNG를 armor layer로 카피
    (단, standalone icon이라 body에 정확히 fit하지 않을 수 있음 — 한계 있음)
  - cape: items/cloak.png를 cape layer로 활용
  - helmet: items/는 helmet 자산 없음 — skip (사용자 imagegen 필요)
  - boots: items/boots.png를 boots layer로

이 스크립트는 환경 한계 내에서 가능한 자산을 모은다. 결과 시각이 awkward할 수
있으니 사용자가 imagegen으로 새로 만들어 교체하는 게 이상적.
"""

from __future__ import annotations
import json
import shutil
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
LAYERS_DIR = REPO_ROOT / "public" / "assets" / "avatars" / "layers"
ITEMS_DIR = REPO_ROOT / "public" / "assets" / "items"
AVATARS_DIR = REPO_ROOT / "public" / "assets" / "avatars"
IMAGEGEN_WEAPONS = REPO_ROOT / "output" / "imagegen" / "all-item-exact-icons"


CANVAS_SIZE = (256, 256)


def fit_to_canvas(src: Path, dst: Path, anchor: str = "center") -> None:
    """src PNG를 256x256 canvas에 fit해서 dst에 저장. transparent bg 보존.

    anchor:
      'center' — 중앙
      'right-hand' — 오른손 위치 (~우측 중간)
      'top' — 상단 중앙 (helmet)
      'bottom' — 하단 중앙 (boots)
    """
    img = Image.open(src).convert("RGBA")
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)

    # canvas에 맞게 비율 유지하며 fit
    canvas_w, canvas_h = CANVAS_SIZE
    src_w, src_h = img.size
    # 영역 별로 max size 결정
    if anchor == "center":
        target_h = int(canvas_h * 0.75)  # body 높이의 75%
    elif anchor in ("right-hand", "top", "bottom"):
        target_h = int(canvas_h * 0.4)
    else:
        target_h = int(canvas_h * 0.6)

    scale = target_h / src_h
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    if anchor == "right-hand":
        # 오른쪽 중간 (~70% x, 50% y)
        cx = int(canvas_w * 0.65) - new_w // 2
        cy = canvas_h // 2 - new_h // 2
    elif anchor == "top":
        cx = canvas_w // 2 - new_w // 2
        cy = int(canvas_h * 0.05)
    elif anchor == "bottom":
        cx = canvas_w // 2 - new_w // 2
        cy = int(canvas_h * 0.78)
    else:
        cx = canvas_w // 2 - new_w // 2
        cy = canvas_h // 2 - new_h // 2

    canvas.alpha_composite(img, (cx, cy))
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst)


def copy_full_canvas(src: Path, dst: Path) -> None:
    """body sprite는 그대로 256x256으로 normalize."""
    img = Image.open(src).convert("RGBA")
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)
    src_w, src_h = img.size
    target_h = int(CANVAS_SIZE[1] * 0.92)  # 거의 full
    scale = target_h / src_h
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    cx = CANVAS_SIZE[0] // 2 - new_w // 2
    cy = CANVAS_SIZE[1] - new_h - 4  # 발이 바닥에 닿게
    canvas.alpha_composite(img, (cx, cy))
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst)


# =============================================================================
# Body layer — weaponless 직업 sprite 활용
# =============================================================================
# adventurer.png가 가장 generic weaponless. 다른 직업은 jobname.png (e.g. knight.png)
BODY_SOURCES = {
    "adventurer": AVATARS_DIR / "adventurer.png",
    "warrior":    AVATARS_DIR / "warrior.png",
    "knight":     AVATARS_DIR / "knight.png",
    "berserker":  AVATARS_DIR / "berserker.png",
    "rogue":      AVATARS_DIR / "rogue.png",
    "assassin":   AVATARS_DIR / "assassin.png",
    "ranger":     AVATARS_DIR / "ranger.png",
    "mage":       AVATARS_DIR / "mage.png",
    "archmage":   AVATARS_DIR / "archmage.png",
    "warlock":    AVATARS_DIR / "warlock.png",
    "paladin":    AVATARS_DIR / "paladin.png",
    "chronomancer": AVATARS_DIR / "chronomancer.png",
    "shadow-lord":  AVATARS_DIR / "shadow-lord.png",
    "grand-mage":   AVATARS_DIR / "grand-mage.png",
}

# =============================================================================
# Weapon layer — 기존 imagegen weapon PNG family 대표
# =============================================================================
WEAPON_SOURCES = {
    "dagger":     IMAGEGEN_WEAPONS / "item-weapon-001.png",  # 녹슨 단검 (기존 chibi)
    "sword":      IMAGEGEN_WEAPONS / "item-weapon-002.png",  # 롱소드
    "staff":      IMAGEGEN_WEAPONS / "item-weapon-003.png",  # 나무지팡이
    "bow":        IMAGEGEN_WEAPONS / "item-weapon-004.png",  # 단궁
    "axe":        IMAGEGEN_WEAPONS / "item-weapon-024.png",  # 전투도끼
    "spear":      IMAGEGEN_WEAPONS / "item-weapon-022.png",  # 병사의 창
    "hammer":     IMAGEGEN_WEAPONS / "item-weapon-014.png",  # 낡은 철퇴
    "wand":       IMAGEGEN_WEAPONS / "item-weapon-006.png",  # 마법봉
    "greatsword": IMAGEGEN_WEAPONS / "item-weapon-016.png",  # 양손검
    "club":       IMAGEGEN_WEAPONS / "item-weapon-005.png",  # 나무곤봉
    "longbow":    IMAGEGEN_WEAPONS / "item-weapon-066.png",  # 큰 활
}

# =============================================================================
# Armor / Cape / Helmet / Boots — items/ chibi 자산 재활용
# =============================================================================
ARMOR_SOURCES = {
    "leather": ITEMS_DIR / "armor.png",   # 일반 갑옷 (가장 가까운 base)
    "plate":   ITEMS_DIR / "armor.png",   # 같은 base — 색감 차이는 PIL tint로 추후
    "robe":    ITEMS_DIR / "robe.png",
    "coat":    ITEMS_DIR / "cloak.png",   # coat은 cloak으로 가까운 base
}

CAPE_SOURCES = {
    "cloak": ITEMS_DIR / "cloak.png",
}

BOOTS_SOURCES = {
    "leather": ITEMS_DIR / "boots.png",
    "plate":   ITEMS_DIR / "boots.png",
    "cloth":   ITEMS_DIR / "boots.png",
}

# helmet은 chibi base 없음 → skip


def deploy_layer(layer_type: str, sources: dict, anchor: str) -> list[str]:
    deployed = []
    target_dir = LAYERS_DIR / layer_type
    target_dir.mkdir(parents=True, exist_ok=True)
    for key, src in sources.items():
        if not src.exists():
            print(f"  ⚠️  {layer_type}/{key} skip (source 없음: {src})")
            continue
        dst = target_dir / f"{key}.png"
        if layer_type == "body":
            copy_full_canvas(src, dst)
        else:
            fit_to_canvas(src, dst, anchor)
        deployed.append(key)
        print(f"  ✓ {layer_type}/{key} ← {src.name}")
    return deployed


def main() -> None:
    print("=== body layers ===")
    body_keys = deploy_layer("body", BODY_SOURCES, "center")

    print("\n=== weapon layers ===")
    weapon_keys = deploy_layer("weapon", WEAPON_SOURCES, "right-hand")

    print("\n=== armor layers ===")
    armor_keys = deploy_layer("armor", ARMOR_SOURCES, "center")

    print("\n=== cape layers ===")
    cape_keys = deploy_layer("cape", CAPE_SOURCES, "center")

    print("\n=== boots layers ===")
    boots_keys = deploy_layer("boots", BOOTS_SOURCES, "bottom")

    summary = {
        "body": body_keys,
        "weapon": weapon_keys,
        "armor": armor_keys,
        "cape": cape_keys,
        "boots": boots_keys,
        "helmet": [],  # 자산 없음
    }
    out_path = REPO_ROOT / "output" / "bootstrapped-layers.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총: body {len(body_keys)} + weapon {len(weapon_keys)} + armor {len(armor_keys)}"
          f" + cape {len(cape_keys)} + boots {len(boots_keys)}")
    print(f"인덱스: {out_path}")


if __name__ == "__main__":
    main()
