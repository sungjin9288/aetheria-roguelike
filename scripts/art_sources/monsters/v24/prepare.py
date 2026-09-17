#!/usr/bin/env python3
"""Export the regional identity batch without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "ash-golem": "997a8ee4f0672f4ba31a3b4252aeea45b74893a2dc3a4e8b003be88525502438",
    "petal-slime": "9ccf17c7682b3c2520237e14fe09929175a7b0bf77b864eb968bfd1547887a32",
    "root-eater": "aec662cdab1afc1368466cb0ffe54f3da9a322e97dd410ee71596631344e316c",
    "storm-wyvern": "fecbb70a7b6ea35db6f157105f25b39f2a13cc6ddaea844c8e34d7c50489679f",
    "wind-drake": "9b81e01fd458507ed4378ab28a81fff8d6e796d220de6c13106b7ddc66f42e1b",
    "world-tree-guardian": "1f62ccd5c95fc4f966dc8a42dfb3c95e3e5fedccf7f4bcfbb0ad07f94f40c223"
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
