#!/usr/bin/env python3
"""Rebuild one tracked equipment sheet in memory and report its exact export hashes."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from process_equipment_art_batch import build_outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--source-sheet", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    batch = json.loads(args.batch.read_text(encoding="utf-8"))
    identities = batch.get("identities")
    if not isinstance(identities, list):
        raise ValueError("Tracked equipment batch identities are invalid")

    inspection_root = Path(tempfile.gettempdir()) / "aetheria-equipment-source-inspection"
    outputs = build_outputs(args.source_sheet, identities, inspection_root)
    result = [
        {
            "cell": identity["cell"],
            "name": identity["name"],
            "exportSha256": export_sha256,
        }
        for identity, _destination, _payload, export_sha256 in outputs
    ]
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
