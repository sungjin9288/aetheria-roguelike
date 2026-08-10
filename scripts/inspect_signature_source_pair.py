#!/usr/bin/env python3
"""Rebuild one paired signature source batch in memory and report exact hashes."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from process_signature_art_batch import build_outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--item-source-sheet", required=True, type=Path)
    parser.add_argument("--overlay-source-sheet", required=True, type=Path)
    return parser.parse_args()


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
    inspection_root = Path(tempfile.gettempdir()) / "aetheria-signature-source-inspection"
    item_outputs, overlay_outputs = build_outputs(
        args.item_source_sheet,
        args.overlay_source_sheet,
        identities,
        registry,
        inspection_root,
    )
    result = [
        {
            "cell": identity["cell"],
            "name": identity["name"],
            "itemExportSha256": item_outputs[index][3],
            "overlayExportSha256": overlay_outputs[index][3],
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
