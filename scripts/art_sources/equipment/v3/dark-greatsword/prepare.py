#!/usr/bin/env python3
"""Prepare a single reviewed replacement cell without adopting runtime assets."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

from PIL import Image

SOURCE = Path(__file__).resolve().parent
sys.path.insert(0, str(SOURCE.parents[3]))
from process_equipment_art_batch import normalize_cell  # noqa: E402
from process_signature_art_batch import normalize_cell as fit_cell  # noqa: E402

PINS = {
    "masters/item.png": "cdceec54ebafe25b617f4e5604551ea95fe33f9fece34babc72081ffb16a7b9f",
    "previous/item-sheet.png": "b8de8917866933ac05976ee4573676e5b3cc379e23049e83ca1a46ccc706aacc",
    "previous/item.png": "f7ba4e202df3c21da330971cfd9112c03b12eda59c1f834fb70db5f48672af6a",
}


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def prepare(output):
    originals = {name: (SOURCE / name).read_bytes() for name in PINS}
    if any(digest(payload) != PINS[name] for name, payload in originals.items()):
        raise ValueError("Original source hash drift; no output created")
    with Image.open(io.BytesIO(originals["masters/item.png"])) as master:
        master.load()
        if master.mode != "RGBA":
            raise ValueError("Expected genuinely transparent RGBA master")
        cleaned = master.copy()
        cleaned.putalpha(master.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0))
        cell = fit_cell(cleaned, "bottom-center", 200, 8)
    with Image.open(io.BytesIO(originals["previous/item-sheet.png"])) as original:
        original.load()
        if original.mode != "RGBA" or original.size != (600, 400):
            raise ValueError("Expected original RGBA 600x400 source sheet")
        sheet = original.copy()
        sheet.paste(cell, (200, 200))
        for index in (0, 1, 2, 3, 5):
            x, y = (index % 3) * 200, (index // 3) * 200
            box = (x, y, x + 200, y + 200)
            if sheet.crop(box).tobytes() != original.crop(box).tobytes():
                raise ValueError("Neighbor cell changed")
        if cell.tobytes() == original.crop((200, 200, 400, 400)).tobytes():
            raise ValueError("Target cell must change")
    images = {"item-sheet.png": sheet, "item.png": normalize_cell(cell, "bottom-center")}
    payloads = {}
    for name, image in images.items():
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=False)
        payloads[name] = buffer.getvalue()
    if any((SOURCE / name).read_bytes() != payload for name, payload in originals.items()):
        raise ValueError("Original changed during preparation")
    receipt = {
        "runtimeAdopted": False,
        "originalsUnchanged": True,
        "targetCell": "bottom-center",
        "targetCellChanged": True,
        "unchangedNeighborCells": 5,
        "alphaThreshold": 128,
        "sourceSha256": PINS,
        "outputSha256": {name: digest(payload) for name, payload in payloads.items()},
    }
    serialized = json.dumps(receipt, indent=2, sort_keys=True) + "\n"
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
