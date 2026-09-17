#!/usr/bin/env python3
"""Prepare reviewed sword sheets without changing originals or runtime assets."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

from PIL import Image

SOURCE = Path(__file__).resolve().parent
sys.path.insert(0, str(SOURCE.parents[3]))
from process_signature_art_batch import normalize_cell  # noqa: E402

PINS = {
    "masters/item.png": "3a443ec2daf260fed916d570f5c1c837ab8ab955d74fba248ae3f3028adfd45c",
    "masters/overlay.png": "eb2c83b6e0afa61de0f11c1abba5b76aa9050cb6f5d8d8d1044659bdd4d4535c",
    "previous/item-sheet.png": "84d7f87f6aef49699138ac33f08f822c675da9a196a4454c8de5822540c94103",
    "previous/overlay-sheet.png": "1c4ac02acbf7f05bcb2d52dcc018d9c9da101ad1c959d82543e0fd97ff3d12fd",
}


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def prepare(output):
    originals = {name: (SOURCE / name).read_bytes() for name in PINS}
    if any(digest(payload) != PINS[name] for name, payload in originals.items()):
        raise ValueError("Original source hash drift; no output created")
    images = {}
    surfaces = {}
    for surface, size, margin in (("item", 160, 8), ("overlay", 72, 4)):
        with Image.open(io.BytesIO(originals[f"masters/{surface}.png"])) as master:
            master.load()
            if master.mode != "RGBA":
                raise ValueError("Master must have true RGBA transparency")
            # These isolated pixel-art masters have faint generator fringe and
            # mostly near-opaque alpha. Normalize a copy, never the source.
            cleaned = master.copy()
            cleaned.putalpha(master.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0))
            cell = normalize_cell(cleaned, "top-left", 200, 8)
        with Image.open(io.BytesIO(originals[f"previous/{surface}-sheet.png"])) as original:
            original.load()
            if original.mode != "RGBA" or original.size != (600, 400):
                raise ValueError("Expected original RGBA 600x400 paired sheet")
            sheet = original.copy()
            sheet.paste(cell, (0, 0))
            neighbors = []
            for index in range(1, 6):
                x, y = (index % 3) * 200, (index // 3) * 200
                box = (x, y, x + 200, y + 200)
                neighbors.append(sheet.crop(box).tobytes() == original.crop(box).tobytes())
            changed = cell.tobytes() != original.crop((0, 0, 200, 200)).tobytes()
            if not all(neighbors) or not changed:
                raise ValueError("Expected only the top-left cell to change")
        images[f"{surface}-sheet.png"] = sheet
        images[f"{surface}.png"] = normalize_cell(cell, "top-left", size, margin)
        surfaces[surface] = {"unchangedNeighborCells": len(neighbors), "targetCellChanged": changed}
    if any((SOURCE / name).read_bytes() != payload for name, payload in originals.items()):
        raise ValueError("Original source changed during preparation")
    payloads = {}
    for name, image in images.items():
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=False)
        payloads[name] = buffer.getvalue()
    receipt = {
        "runtimeAdopted": False,
        "originalsUnchanged": True,
        "alphaThreshold": 128,
        "sourceSha256": PINS,
        "surfaces": surfaces,
        "outputSha256": {name: digest(payload) for name, payload in payloads.items()},
    }
    serialized = json.dumps(receipt, indent=2, sort_keys=True) + "\n"
    # Exclusive directory creation also refuses symlinks and existing outputs.
    output.mkdir(parents=False, exist_ok=False)
    for name, payload in payloads.items():
        with (output / name).open("xb") as destination:
            destination.write(payload)
    with (output / "receipt.json").open("x") as destination:
        destination.write(serialized)
    return serialized


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    print(prepare(parser.parse_args().output), end="")
