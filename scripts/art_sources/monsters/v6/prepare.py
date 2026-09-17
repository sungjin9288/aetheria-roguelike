#!/usr/bin/env python3
"""Normalize only the three reviewed early-monster masters into new files."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / "masters"
PINS = {
    "goblin": "4135e83b69b70aa1e3ac8fe31927151c620ecd73d7897e8c8bbb990053c4fcb6",
    "kobold": "399c361a0b37f36f90108e1b3149678b5f3198deb96a15067864f58e716ba71d",
    "green-slime": "68dc614255cb418fb53ddee28fe02dd7a225b48d6b56dcb0a918695b3961f2c9",
}


def prepare(output):
    originals = {name: (SOURCE / f"{name}.png").read_bytes() for name in PINS}
    if any(hashlib.sha256(data).hexdigest() != PINS[name] for name, data in originals.items()):
        raise ValueError("Reviewed master hash drift; no output created")
    exports = {}
    for name, data in originals.items():
        with Image.open(io.BytesIO(data)) as master:
            master.load()
            if master.mode != "RGBA" or master.getchannel("A").getextrema()[0] != 0:
                raise ValueError(f"Missing true transparency: {name}")
            cleaned = master.copy()
            cleaned.putalpha(master.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0))
        bounds = cleaned.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"Empty silhouette: {name}")
        cropped = cleaned.crop(bounds)
        scale = 144 / max(cropped.size)
        width = max(1, round(cropped.width * scale))
        height = max(1, round(cropped.height * scale))
        icon = cropped.resize((width, height), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (160, 160))
        canvas.alpha_composite(icon, ((160 - width) // 2, 152 - height))
        buffer = io.BytesIO()
        canvas.save(buffer, format="PNG", optimize=False)
        exports[name] = buffer.getvalue()
    if any((SOURCE / f"{name}.png").read_bytes() != data for name, data in originals.items()):
        raise ValueError("Master changed during preparation")
    receipt = {
        "originalsUnchanged": True,
        "runtimeAdopted": False,
        "alphaThreshold": 128,
        "sourceSha256": PINS,
        "exportSha256": {name: hashlib.sha256(data).hexdigest() for name, data in exports.items()},
    }
    serialized = json.dumps(receipt, indent=2, sort_keys=True) + "\n"
    output.mkdir(exist_ok=False)
    for name, data in exports.items():
        with (output / f"{name}.png").open("xb") as destination:
            destination.write(data)
    with (output / "receipt.json").open("x") as destination:
        destination.write(serialized)
    return serialized


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    print(prepare(parser.parse_args().output), end="")
