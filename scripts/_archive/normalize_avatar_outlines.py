"""아바타 base PNG의 outline을 artPalette 기준(#2a1f2e)으로 정규화.

목적: 현재 52개 avatar sprite의 outline이 pure black(#000000)인데 새 family wearable은
dark plum(#2a1f2e)을 쓴다. 두 레이어가 함께 렌더될 때 톤이 어긋나는 문제 해결.

전략 (보수적):
- alpha > 200인 opaque 픽셀만 대상 (antialiasing edge는 건드리지 않음)
- luminance < 8인 near-black 픽셀만 #2a1f2e로 치환 (shaded 영역은 유지)
- 원본 RGB 대비 거의 변화 없는 경우만 치환 — 안전 마진 확보

실행: python3 scripts/normalize_avatar_outlines.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent
AVATAR_DIR = REPO_ROOT / "public" / "assets" / "avatars"
PALETTE_JSON = REPO_ROOT / "src" / "data" / "artPalette.json"
ARTIFACT_DIR = REPO_ROOT / "output" / "imagegen" / "avatar-outline-normalized"

# 치환 임계값 — luminance 8 미만은 avatar art 안에서 pure black 외에는 거의 없음.
DARK_LUMA_THRESHOLD = 8


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    clean = hex_color.lstrip("#")
    return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))


def load_target_outline() -> tuple[int, int, int]:
    raw = json.loads(PALETTE_JSON.read_text(encoding="utf-8"))
    return _hex_to_rgb(raw["artDirection"]["defaultOutline"])


def normalize_image(path: Path, target_rgb: tuple[int, int, int]) -> tuple[int, Image.Image]:
    """pure black outline 픽셀을 target_rgb로 치환. (치환 픽셀 수, 새 이미지)."""
    image = Image.open(path).convert("RGBA")
    px = image.load()
    changed = 0
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a <= 200:
                continue
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            if luma < DARK_LUMA_THRESHOLD:
                px[x, y] = (target_rgb[0], target_rgb[1], target_rgb[2], a)
                changed += 1
    return changed, image


def main() -> None:
    target_rgb = load_target_outline()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    png_files = sorted(AVATAR_DIR.glob("*.png"))

    report = []
    total_changed = 0
    for png in png_files:
        changed, image = normalize_image(png, target_rgb)
        if changed > 0:
            image.save(png)  # in-place (git으로 변경 추적 가능)
            image.save(ARTIFACT_DIR / png.name)
            report.append({"file": png.name, "outline_pixels_normalized": changed})
            total_changed += changed

    manifest = {
        "target_outline_rgb": list(target_rgb),
        "threshold_luma": DARK_LUMA_THRESHOLD,
        "total_files_touched": len(report),
        "total_pixels_normalized": total_changed,
        "details": report,
    }
    (ARTIFACT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps(
        {
            "target_outline": f"#{target_rgb[0]:02x}{target_rgb[1]:02x}{target_rgb[2]:02x}",
            "files_touched": len(report),
            "pixels_normalized": total_changed,
        },
        indent=2,
    ))


if __name__ == "__main__":
    main()
