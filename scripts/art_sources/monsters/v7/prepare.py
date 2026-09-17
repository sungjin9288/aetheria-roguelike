#!/usr/bin/env python3
"""Extract reviewed background regions and prepare preserved regional masters."""

import argparse
from collections import deque
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
SELECTION = {
    'centipede': ('centipede', 'e1854ec9593eb9d145e7cad1ca20736bd90d26b462bfde4a0e967b50f11ba9e1', []),
    'harpy': ('harpy-compact-candidate', '3e9679a9ebfafea9483223dec3a4fa5c12636c90923ca0dfeb09e13fb5ec7620',
              [(0, 0), (560, 817), (549, 800), (426, 426), (460, 762), (774, 527)]),
    'water-spirit': ('water-spirit', 'e64573d614293c2a94f8011fe260e884ff1015a52a7a13da8a090150722482f0', []),
    'dark-mage': ('dark-mage-readable', 'a772ed3b8aca55d014e04369c4d0c92f27e4ab0ee43313f15b6dfee08d301b4a', []),
    'kobold-miner': ('kobold-miner', 'c04ea1e1e9fe64d43880c118b0dcae221f9bf22efaf732628318f1fd5c8aec0c',
                     [(0, 0), (783, 550), (491, 492)]),
}


def remove_background(image, seeds):
    """Remove only seed-connected bright neutral pixels, preserving highlights."""
    result = image.convert('RGBA')
    pixels = result.load()
    width, height = result.size

    def background(x, y):
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and min(red, green, blue) >= 225 and max(red, green, blue) - min(red, green, blue) <= 12

    for x, y in seeds:
        if not (0 <= x < width and 0 <= y < height) or not background(x, y):
            raise ValueError(f'Invalid background seed: {(x, y)}')
    pending = deque()

    def enqueue(x, y):
        if background(x, y):
            pixels[x, y] = (0, 0, 0, 0)
            pending.append((x, y))

    for x, y in seeds:
        enqueue(x, y)
    while pending:
        x, y = pending.popleft()
        if x: enqueue(x - 1, y)
        if x + 1 < width: enqueue(x + 1, y)
        if y: enqueue(x, y - 1)
        if y + 1 < height: enqueue(x, y + 1)
    return result


def prepare(output):
    originals = {name: (SOURCE / f'{master}.png').read_bytes() for name, (master, _, _) in SELECTION.items()}
    for name, data in originals.items():
        if hashlib.sha256(data).hexdigest() != SELECTION[name][1]:
            raise ValueError(f'Reviewed master hash drift: {name}')
    payloads = {}
    for name, data in originals.items():
        seeds = SELECTION[name][2]
        with Image.open(io.BytesIO(data)) as master:
            master.load()
            if not seeds and (master.mode != 'RGBA' or master.getchannel('A').getextrema()[0] != 0):
                raise ValueError(f'Missing true transparency: {name}')
            cleaned = remove_background(master, seeds) if seeds else master.copy()
        cleaned.putalpha(cleaned.getchannel('A').point(lambda alpha: 255 if alpha >= 128 else 0))
        bounds = cleaned.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty silhouette: {name}')
        cropped = cleaned.crop(bounds)
        scale = 144 / max(cropped.size)
        width, height = max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))
        canvas = Image.new('RGBA', (160, 160))
        canvas.alpha_composite(cropped.resize((width, height), Image.Resampling.NEAREST), ((160-width)//2, 152-height))
        buffer = io.BytesIO()
        canvas.save(buffer, format='PNG', optimize=False)
        payloads[name] = buffer.getvalue()
    for name, (master, _, _) in SELECTION.items():
        if (SOURCE / f'{master}.png').read_bytes() != originals[name]:
            raise ValueError(f'Master changed during preparation: {name}')
    receipt = {
        'originalsUnchanged': True,
        'runtimeAdopted': False,
        'alphaThreshold': 128,
        'selection': {name: {'master': master + '.png', 'sha256': pin, 'backgroundSeeds': seeds}
                      for name, (master, pin, seeds) in SELECTION.items()},
        'exportSha256': {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()},
    }
    serialized = json.dumps(receipt, indent=2, sort_keys=True) + '\n'
    output.mkdir(exist_ok=False)
    for name, data in payloads.items():
        with (output / f'{name}.png').open('xb') as destination:
            destination.write(data)
    with (output / 'receipt.json').open('x') as destination:
        destination.write(serialized)
    return serialized


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    print(prepare(parser.parse_args().output), end='')
