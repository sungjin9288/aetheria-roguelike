"""Slice 25: 시그니처 25종 픽셀 아트 재생성 — 아바타 결 통일.

기존 signature-*.png는 평면 도형 수준의 플레이스홀더라 아바타/장비
family의 풍부한 픽셀 결과 충돌했다. 이 스크립트는 family 아트와 같은
고품질 원본 아이콘(public/assets/items/*.png)을 기반으로:

1. hue-shift 리컬러 — signatureRegistry의 tone(artPalette 키)으로 정체성
   색을 입히되, 원본의 멀티 머티리얼 음영(블레이드/힐트 대비)을 보존.
2. 전설 이펙트 — trim 컬러 스파클 + 외곽 오라 글로우.
3. spriteKey 시드 기반 결정론 — 같은 base를 쓰는 시그니처끼리도
   스파클 배치가 달라 구분된다.

출력 파일명이 기존과 동일(signature-*.png)이므로 코드 변경 0건.
"""
from __future__ import annotations

import colorsys
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "public" / "assets" / "items"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact"
REGISTRY = REPO_ROOT / "src" / "data" / "signatureRegistry.json"
PALETTE_JSON = REPO_ROOT / "src" / "data" / "artPalette.json"

CANVAS = 160

# spriteKey → 원본 base 아이콘 (family 아트와 동일 소스 풀)
BASE_BY_SPRITE = {
    "signature-weapon-ethernia": "sword",
    "signature-weapon-demon-scythe": "scythe",
    "signature-weapon-ragnarok": "greatsword",
    "signature-weapon-dimension-scythe": "scythe",
    "signature-shield-celestial-tome": "book",
    "signature-armor-dragon-lord": "armor",
    "signature-armor-dark-lord-cloak": "cloak",
    "signature-weapon-worldtree-staff": "staff",
    "signature-shield-aegis-dimension": "shield",
    "signature-shield-ether-grimoire": "book",
    "signature-weapon-divine-wrath-staff": "staff",
    "signature-weapon-frost-crown-sword": "sword",
    "signature-weapon-wind-ultimate-bow": "bow",
    "signature-weapon-shadow-cutter": "dagger",
    "signature-weapon-holy-spear": "spear",
    "signature-weapon-dragon-flame": "greatsword",
    "signature-weapon-worldtree-sword": "sword",
    "signature-weapon-temple-city-staff": "wand",
    "signature-armor-mad-armor": "armor",
    "signature-armor-worldtree-robe": "robe",
    "signature-weapon-ether-giant-greatsword": "greatsword",
    "signature-weapon-soul-reaper": "dagger",
    "signature-weapon-earth-verdict": "hammer",
    "signature-armor-abyssal-guardian": "armor",
    "signature-armor-chaos-armor": "armor",
}


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    clean = value.lstrip("#")
    return tuple(int(clean[i : i + 2], 16) for i in (0, 2, 4))


PALETTE_SLOTS = ("outline", "shade", "mid", "hi", "trim")


def load_palettes() -> dict[str, dict[str, tuple[int, int, int]]]:
    raw = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    return {
        key: {slot: hex_to_rgb(palette[slot]) for slot in PALETTE_SLOTS if slot in palette}
        for key, palette in raw["tonePalettes"].items()
    }


def seed_rng(key: str):
    """spriteKey 기반 결정론 의사난수 (0~1 float generator)."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    state = list(digest)
    idx = 0

    def rng() -> float:
        nonlocal idx
        value = state[idx % len(state)]
        idx += 1
        return value / 255.0

    return rng


def hue_shift(image: Image.Image, target_rgb: tuple[int, int, int]) -> Image.Image:
    """원본 음영/머티리얼 대비(S/V 텍스처)를 보존하면서 hue를 tone으로 끌어당긴다.

    - 채도 있는 픽셀: hue를 거의 완전히(0.9) target으로 — 결은 S/V에 살아
      있으므로 hue를 세게 당겨도 텍스처가 유지된다 (holy 보석이 녹금색으로
      어중간하게 남던 문제 해소).
    - 무채색 픽셀(금속/아웃라인): 어두운 픽셀은 그대로(아웃라인 보존),
      밝은 금속면은 target 쪽으로 약한 틴트 — rust/fire 갑주가 회분홍으로
      남던 문제 해소.
    """
    th, ts, tv = colorsys.rgb_to_hsv(*(c / 255.0 for c in target_rgb))
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if s > 0.08:
                w = 0.9
                dh = ((th - h + 0.5) % 1.0) - 0.5
                nh = (h + dh * w) % 1.0
                ns = min(1.0, s * 0.82 + ts * 0.3)
                nv = v
            elif v > 0.35:
                # 밝은 무채색(금속면) → tone 틴트
                nh = th
                ns = min(1.0, ts * 0.4 * v)
                nv = v
            else:
                # 어두운 아웃라인 — 결 그대로
                nh, ns, nv = h, s, v
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def add_aura(canvas: Image.Image, sprite: Image.Image, pos: tuple[int, int], glow_rgb: tuple[int, int, int]) -> None:
    """외곽 글로우 — 실루엣을 키워 부드럽게 깐다 (전설 등급 신호)."""
    alpha = sprite.getchannel("A")
    silhouette = Image.new("RGBA", sprite.size, (*glow_rgb, 255))
    silhouette.putalpha(alpha)
    glow = silhouette.resize((sprite.width + 10, sprite.height + 10), Image.NEAREST)
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    glow_alpha = glow.getchannel("A").point(lambda v: int(v * 0.42))
    glow.putalpha(glow_alpha)
    canvas.alpha_composite(glow, (pos[0] - 5, pos[1] - 5))


def add_sparkles(canvas: Image.Image, rng, color: tuple[int, int, int], count: int = 4) -> None:
    """non-equipment family(크리스탈/허브)와 동일 문법의 + 모양 스파클."""
    draw = ImageDraw.Draw(canvas)
    for _ in range(count):
        cx = 14 + int(rng() * (CANVAS - 28))
        cy = 14 + int(rng() * (CANVAS - 28))
        size = 2 + int(rng() * 2)  # 2~3px 블록
        arm = size * 2
        body = (*color, 235)
        soft = (*color, 110)
        draw.rectangle((cx - size // 2, cy - arm, cx + size - 1 - size // 2, cy + arm + size - 1), fill=soft)
        draw.rectangle((cx - arm, cy - size // 2, cx + arm + size - 1, cy + size - 1 - size // 2), fill=soft)
        draw.rectangle((cx - size // 2, cy - size // 2, cx + size - 1 - size // 2, cy + size - 1 - size // 2), fill=body)


def build_signature(sprite_key: str, base_key: str, tone: dict[str, tuple[int, int, int]]) -> Image.Image:
    source = Image.open(SOURCE_DIR / f"{base_key}.png").convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if bbox:
        source = source.crop(bbox)

    recolored = hue_shift(source, tone["mid"])

    # 캔버스 중앙 배치 (max 124px — 오라/스파클 여백 확보)
    sprite = recolored.copy()
    sprite.thumbnail((124, 124), Image.NEAREST)
    pos = ((CANVAS - sprite.width) // 2, (CANVAS - sprite.height) // 2)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    add_aura(canvas, sprite, pos, tone["trim"])
    canvas.alpha_composite(sprite, pos)
    rng = seed_rng(sprite_key)
    add_sparkles(canvas, rng, tone["trim"], count=3 + int(rng() * 3))
    return canvas


def main() -> None:
    palettes = load_palettes()
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    generated = 0
    for name, entry in registry["entries"].items():
        sprite_key = entry["spriteKey"]
        base_key = BASE_BY_SPRITE.get(sprite_key)
        tone = palettes.get(entry.get("tone", ""), palettes["steel"])
        if not base_key:
            print(f"SKIP (base 미지정): {sprite_key}")
            continue
        image = build_signature(sprite_key, base_key, tone)
        out = OUTPUT_DIR / f"{sprite_key}.png"
        image.save(out)
        generated += 1
        print(f"OK {sprite_key} ← {base_key} ({entry.get('tone')}) — {name}")
    print(f"\n{generated} signature assets regenerated → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
