#!/usr/bin/env python3
"""Export the approved guard-duty candidates without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "abyss-guardian": "d095a0a4d6b7a6226c8ebe9e2d8ff2e739a8a2c425a9bf7aa944706b6d840b66",
    "arcane-watcher": "9d86ec93b76cebf214231c82277a5f3369b1b087484c97203f4225c360757b2a",
    "crystal-keeper": "7a65096ef6692f3d5c4f01e4ce8c333d7c5b1de207ed99dfefec12984b880458",
    "darkness-guardian": "78b97039e5c9677754b15e49a4d80eccc7fc23c123067baaa438cc66e39f748b",
    "laboratory-guardian": "cc1ec6143dc8fada44a5ca5aa5e8fe76073a8bdad2052e550d17b9e7f514518d",
    "last-guardian": "8a4a0b9e903c136a4616881dc456d0078423a33a479ced6ce9f38ef654c496f6",
    "outpost-watchman": "8deeac56eb928f1e8492afbe19a0ea87be0aaa8329e5d660e07af5552a97761d",
    "rift-sentinel": "68cd3fb3282869b5970032d9388f362c3dff67da8979140a18cd91b518740825",
    "storm-guardian": "16a8284a41ed452e4cb26b142f274775ad4abfd68629ab1eba619757fb28a5e8",
    "temple-guard": "ff50be378f595cb68e03c25ce82659c4c015cbac1daf2bbaef28a2c30aa9a1e5",
    "tower-guardian": "b0a800a30a74f8564a4373d6d699a75ddce1fbc9c600e2fde9b14e29f79e2c36",
    "trap-guardian": "3c5c6049e819967e1313629239c98bd7c20417cc2f1f2bd95daa647366094aba"
}


def prepare(output, source_dir=SOURCE):
    if output.exists():
        raise FileExistsError(output)
    originals = {name: (source_dir / f'{name}.png').read_bytes() for name in PINS}
    for name, data in originals.items():
        if hashlib.sha256(data).hexdigest() != PINS[name]:
            raise ValueError(f'Reviewed master hash drift: {name}')
    payloads = {}
    for name, data in originals.items():
        with Image.open(io.BytesIO(data)) as master:
            master.load()
            if master.mode != 'RGBA' or master.getchannel('A').getextrema()[0] != 0:
                raise ValueError(f'Missing true transparency: {name}')
            sprite = master.copy()
        sprite.putalpha(sprite.getchannel('A').point(lambda alpha: 255 if alpha >= 128 else 0))
        bounds = sprite.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty silhouette: {name}')
        sprite = sprite.crop(bounds)
        scale = 144 / max(sprite.size)
        width, height = max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))
        scaled = sprite.resize((width, height), Image.Resampling.NEAREST)
        scaled = scaled.crop(scaled.getchannel('A').getbbox())
        canvas = Image.new('RGBA', (160, 160))
        canvas.alpha_composite(scaled, ((160-scaled.width)//2, 152-scaled.height))
        buffer = io.BytesIO()
        canvas.save(buffer, format='PNG', optimize=False)
        payloads[name] = buffer.getvalue()
    for name, data in originals.items():
        if (source_dir / f'{name}.png').read_bytes() != data:
            raise ValueError(f'Master changed during preparation: {name}')
    receipt = json.dumps({
        'originalsUnchanged': True,
        'runtimeAdopted': False,
        'alphaThreshold': 128,
        'sourceSha256': PINS,
        'exportSha256': {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()},
    }, indent=2, sort_keys=True) + '\n'
    output.mkdir(exist_ok=False)
    for name, data in payloads.items():
        with (output / f'{name}.png').open('xb') as destination:
            destination.write(data)
    with (output / 'receipt.json').open('x') as destination:
        destination.write(receipt)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    print(prepare(parser.parse_args().output), end='')
