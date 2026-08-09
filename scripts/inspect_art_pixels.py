#!/usr/bin/env python3
"""Inspect one PNG's alpha, opaque bounds, and optional character foot baseline."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def inspect_png(path: Path, margin: int, foot_baseline: int | None) -> dict[str, object]:
    with Image.open(path) as source:
        source.load()
        has_alpha = "A" in source.getbands() or "transparency" in source.info
        image = source.convert("RGBA")

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    transparent_pixels = any(value == 0 for value in alpha.getdata())

    opaque_bounds = None
    bounds_within_margin = False
    foot_position = None
    foot_baseline_matches = foot_baseline is None
    if bounds:
        left, top, right, bottom = bounds
        opaque_bounds = {"left": left, "top": top, "right": right - 1, "bottom": bottom - 1}
        bounds_within_margin = (
            left >= margin
            and top >= margin
            and right - 1 <= image.width - margin - 1
            and bottom - 1 <= image.height - margin - 1
        )
        foot_position = bottom - 1
        if foot_baseline is not None:
            foot_baseline_matches = foot_position == foot_baseline

    return {
        "boundsWithinMargin": bounds_within_margin,
        "footBaseline": foot_position,
        "footBaselineMatches": foot_baseline_matches,
        "hasAlpha": has_alpha,
        "hasTransparentPixels": transparent_pixels,
        "opaqueBounds": opaque_bounds,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect PNG alpha and placement metadata.")
    parser.add_argument("--path", required=True, type=Path)
    parser.add_argument("--margin", required=True, type=int)
    parser.add_argument("--foot-baseline", type=int)
    args = parser.parse_args()

    if args.margin < 0:
        parser.error("--margin must be zero or greater")

    result = inspect_png(args.path, args.margin, args.foot_baseline)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
