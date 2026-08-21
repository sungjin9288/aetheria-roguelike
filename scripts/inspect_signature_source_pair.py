#!/usr/bin/env python3
"""Rebuild one paired signature source batch in memory and report exact hashes."""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

from process_signature_art_batch import build_outputs
from process_equipment_art_batch import sha256_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--item-source-sheet", required=True, type=Path)
    parser.add_argument("--overlay-source-sheet", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    return parser.parse_args()


def require_matching_runtime_pixels(payload: bytes, runtime_path: Path, name: str) -> None:
    with Image.open(io.BytesIO(payload)) as reconstructed, Image.open(runtime_path) as runtime:
        reconstructed.load()
        runtime.load()
        if (
            reconstructed.mode != "RGBA"
            or runtime.mode != "RGBA"
            or reconstructed.size != runtime.size
            or reconstructed.tobytes() != runtime.tobytes()
        ):
            raise ValueError(f"Signature source does not reproduce runtime exports: {name}")


def main() -> None:
    args = parse_args()
    batch = json.loads(args.batch.read_text(encoding="utf-8"))
    identities = batch.get("identities")
    if not isinstance(identities, list):
        raise ValueError("Tracked signature batch identities are invalid")
    registry = {
        identity["name"]: {"spriteKey": identity["spriteKey"]}
        for identity in identities
    }
    item_outputs, overlay_outputs = build_outputs(
        args.item_source_sheet,
        args.overlay_source_sheet,
        identities,
        registry,
        args.public_root,
    )
    for index, identity in enumerate(identities):
        require_matching_runtime_pixels(item_outputs[index][2], item_outputs[index][1], identity["name"])
        require_matching_runtime_pixels(overlay_outputs[index][2], overlay_outputs[index][1], identity["name"])
    result = [
        {
            "cell": identity["cell"],
            "name": identity["name"],
            "itemExportSha256": sha256_file(item_outputs[index][1]),
            "overlayExportSha256": sha256_file(overlay_outputs[index][1]),
        }
        for index, identity in enumerate(identities)
    ]
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
