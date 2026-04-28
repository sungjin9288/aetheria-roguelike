"""아바타 PNG의 outline 색상 분포 분석.

현재 52개 base avatar PNG가 새 artPalette.json의 outline(#2a1f2e)과 얼마나 다른지 측정.
Post-processing 적용 안전성 판단에 사용.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent
AVATAR_DIR = REPO_ROOT / "public" / "assets" / "avatars"


def luminance(pixel: tuple[int, int, int]) -> float:
    r, g, b = pixel[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def analyze(path: Path) -> dict:
    """PNG에서 가장 어두운 픽셀군(outline 후보)을 추출."""
    image = Image.open(path).convert("RGBA")
    pixels = list(image.getdata())
    opaque = [p for p in pixels if p[3] > 200]
    if not opaque:
        return {"path": path.name, "error": "no opaque pixels"}

    # 하위 10% 루미넌스 = outline 후보
    sorted_by_lum = sorted(opaque, key=luminance)
    cutoff = max(1, len(sorted_by_lum) // 10)
    outline_candidates = sorted_by_lum[:cutoff]

    # 이 중 가장 빈번한 색 3종
    counter = Counter((p[0], p[1], p[2]) for p in outline_candidates)
    top3 = counter.most_common(3)

    return {
        "name": path.name,
        "total_opaque": len(opaque),
        "outline_candidate_count": len(outline_candidates),
        "top_outline_colors": [
            {"rgb": list(rgb), "hex": f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}", "count": cnt}
            for rgb, cnt in top3
        ],
    }


def main() -> None:
    png_files = sorted(AVATAR_DIR.glob("*.png"))
    summary = []
    all_top_colors: Counter = Counter()

    for png in png_files:
        info = analyze(png)
        summary.append(info)
        if "top_outline_colors" in info:
            for entry in info["top_outline_colors"]:
                all_top_colors[entry["hex"]] += entry["count"]

    overall_top = all_top_colors.most_common(10)

    print(json.dumps({
        "scanned": len(png_files),
        "top_outline_colors_across_all_avatars": [
            {"hex": h, "count": c} for h, c in overall_top
        ],
        "sample": summary[:3],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
