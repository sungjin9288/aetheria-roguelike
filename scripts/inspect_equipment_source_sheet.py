#!/usr/bin/env python3
"""Rebuild one tracked equipment sheet in memory and report its exact export hashes."""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

from process_equipment_art_batch import build_outputs, sha256_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--source-sheet", required=True, type=Path)
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
            raise ValueError(f"Equipment source does not reproduce its runtime export: {name}")


def main() -> None:
    args = parse_args()
    batch = json.loads(args.batch.read_text(encoding="utf-8"))
    identities = batch.get("identities")
    if not isinstance(identities, list):
        raise ValueError("Tracked equipment batch identities are invalid")

    outputs = build_outputs(args.source_sheet, identities, args.public_root)
    for identity, runtime_path, payload, _export_sha256 in outputs:
        require_matching_runtime_pixels(payload, runtime_path, identity["name"])
    result = [
        {
            "cell": identity["cell"],
            "name": identity["name"],
            "exportSha256": sha256_file(runtime_path),
        }
        for identity, runtime_path, _payload, _export_sha256 in outputs
    ]
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
