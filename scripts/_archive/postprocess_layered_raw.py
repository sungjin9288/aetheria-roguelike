#!/usr/bin/env python3
"""
postprocess_layered_raw.py

ChatGPT/DALL-E 3에서 받은 raw PNG를 layered system용으로 정규화.

Input:  output/imagegen/staged-layered-raw/{layerType}/{key}.png
Output: output/imagegen/staged-layered/{layerType}/{key}.png

처리:
  1. 흰색/단색 배경 제거 (이미 transparent면 skip)
  2. alpha bbox crop으로 객체 영역만 추출
  3. layer type별 anchor에 맞춰 256x256 canvas에 정확히 배치
     - body: full canvas, 발이 바닥에 닿게
     - armor: chest area (~y=30~70%)
     - weapon: right-hand (~x=70%, y=50%)
     - boots: bottom center (~y=85%)
     - helmet: top center (~y=10%)
     - cape: full body, behind layer
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image
import json

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "output" / "imagegen" / "staged-layered-raw"
STAGED_DIR = REPO_ROOT / "output" / "imagegen" / "staged-layered"

CANVAS = 256

# Layer별 (target_height_ratio, anchor_y_ratio, anchor_x_ratio)
# height_ratio: 객체가 차지하는 캔버스 높이 비율
# anchor_y/x: 객체 중심이 위치할 캔버스 좌표 비율
LAYER_PLACEMENT = {
    "body":   {"height_ratio": 0.92, "anchor_x": 0.50, "anchor_y_bottom": True, "padding_bottom": 0.04},
    "cape":   {"height_ratio": 0.92, "anchor_x": 0.50, "anchor_y_bottom": True, "padding_bottom": 0.06},
    "armor":  {"height_ratio": 0.42, "anchor_x": 0.50, "anchor_y": 0.46},
    "boots":  {"height_ratio": 0.18, "anchor_x": 0.50, "anchor_y": 0.86},
    # weapon: 살짝 안쪽으로 (0.68→0.62) + 약간 작게 (0.55→0.50) — 잘림 방지 + 비율 자연스러움
    "weapon": {"height_ratio": 0.50, "anchor_x": 0.62, "anchor_y": 0.50},
    "helmet": {"height_ratio": 0.22, "anchor_x": 0.50, "anchor_y": 0.13},
}


def remove_solid_bg(img: Image.Image, tolerance: int = 30) -> Image.Image:
    """4 코너 평균색이 거의 한 색이면 배경으로 간주, 비슷한 픽셀을 alpha=0.

    이미 transparent면 효과 거의 없음 (코너가 이미 alpha=0이라).
    """
    img = img.convert("RGBA").copy()
    w, h = img.size
    pixels = img.load()
    corners = [pixels[0, 0], pixels[w-1, 0], pixels[0, h-1], pixels[w-1, h-1]]
    alpha_corners = [c[3] for c in corners]
    # 코너가 이미 transparent면 skip
    if max(alpha_corners) < 30:
        return img
    avg_rgb = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    threshold = tolerance * 3
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            dist = abs(r - avg_rgb[0]) + abs(g - avg_rgb[1]) + abs(b - avg_rgb[2])
            if dist < threshold:
                pixels[x, y] = (r, g, b, 0)
    return img


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox) if bbox else img


def normalize_for_layer(img: Image.Image, layer_type: str) -> Image.Image:
    """layer type에 따라 256x256 canvas에 정확한 anchor로 배치."""
    img = img.convert("RGBA")
    img = remove_solid_bg(img)
    img = trim_alpha(img)

    cfg = LAYER_PLACEMENT.get(layer_type, LAYER_PLACEMENT["body"])
    src_w, src_h = img.size
    target_h = int(CANVAS * cfg["height_ratio"])
    scale = target_h / max(1, src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    cx_ratio = cfg["anchor_x"]

    if cfg.get("anchor_y_bottom"):
        # 발이 바닥 근처
        padding = int(CANVAS * cfg.get("padding_bottom", 0.02))
        cy = CANVAS - new_h - padding
    else:
        # anchor_y는 객체 중심 위치
        cy_ratio = cfg["anchor_y"]
        cy = int(CANVAS * cy_ratio) - new_h // 2

    cx = int(CANVAS * cx_ratio) - new_w // 2
    canvas.alpha_composite(img, (cx, cy))
    return canvas


def main() -> None:
    if not RAW_DIR.exists():
        print(f"Raw 디렉토리 없음: {RAW_DIR}")
        sys.exit(1)

    processed = []
    for layer_dir in RAW_DIR.iterdir():
        if not layer_dir.is_dir():
            continue
        layer_type = layer_dir.name
        if layer_type not in LAYER_PLACEMENT:
            print(f"  ⚠️  unknown layer type {layer_type} — skip")
            continue
        for png in layer_dir.glob("*.png"):
            key = png.stem
            try:
                img = Image.open(png)
                out = normalize_for_layer(img, layer_type)
                out_path = STAGED_DIR / layer_type / f"{key}.png"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out.save(out_path)
                processed.append({"layer": layer_type, "key": key, "out": str(out_path)})
                print(f"  ✓ {layer_type}/{key} → {out_path.relative_to(REPO_ROOT)}")
            except Exception as e:
                print(f"  ⚠️  {layer_type}/{key} 실패: {e}")

    summary_path = REPO_ROOT / "output" / "postprocess-summary.json"
    summary_path.write_text(json.dumps(processed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총 {len(processed)}개 처리. 인덱스: {summary_path}")
    print("\n다음 단계:")
    print("  node scripts/deploy_layered_sprites.mjs")


if __name__ == "__main__":
    main()
