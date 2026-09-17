#!/usr/bin/env python3
"""Inspect one PNG's alpha, opaque bounds, and optional character foot baseline."""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

from PIL import Image


def inspect_png(path: Path, margin: int, foot_baseline: int | None) -> dict[str, object]:
    with Image.open(path) as source:
        source.load()
        has_alpha = "A" in source.getbands() or "transparency" in source.info
        image = source.convert("RGBA")

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    try:
        alpha_values = alpha.get_flattened_data()
    except AttributeError:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            alpha_values = alpha.getdata()
    transparent_pixels = any(value == 0 for value in alpha_values)

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
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--path", type=Path)
    mode.add_argument("--batch", action="store_true")
    parser.add_argument("--margin", type=int)
    parser.add_argument("--foot-baseline", type=int)
    args = parser.parse_args()

    if args.batch:
        requests = json.load(sys.stdin)
        if not isinstance(requests, list):
            parser.error("batch input must be a JSON array")
        results = []
        for request in requests:
            if not isinstance(request, dict):
                parser.error("each batch request must be an object")
            path = request.get("path")
            margin = request.get("margin")
            foot_baseline = request.get("footBaseline")
            if not isinstance(path, str) or not isinstance(margin, int) or margin < 0:
                parser.error("each batch request requires a path and non-negative integer margin")
            if foot_baseline is not None and not isinstance(foot_baseline, int):
                parser.error("footBaseline must be an integer or null")
            results.append(inspect_png(Path(path), margin, foot_baseline))
        print(json.dumps(results, ensure_ascii=False, sort_keys=True))
        return

    if args.margin is None or args.margin < 0:
        parser.error("--margin must be zero or greater")
    result = inspect_png(args.path, args.margin, args.foot_baseline)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
