#!/usr/bin/env python3
"""Prepare reviewed cave/snow sprites without changing their source masters."""

import argparse
from collections import deque
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
SELECTION = {
    'bat-swarm': ('bat-swarm', '9989ed75c2c252720566991f2ab97ed0c950b80cb2aaf4033b1a41498b344697', None, []),
    'cave-troll': ('cave-troll', '15e76ef66986b384e5e835ba0950a5146b9b675908481842e5e45f36eb5967a4', None, []),
    'crystal-golem': ('crystal-golem', 'cbdfe527e85a57382ebf4429465ded0b05875815c04fdef59727a8de0f42e014', None, []),
    'crystal-spirit': ('crystal-spirit', '7193ae759fe60a3feb632cab6a7043f03ca49e3b8abb2a40fe6818919aac0c1c', None, []),
    'dark-elf': ('dark-elf-compact', 'ae3ce5e5936b5589c46e196471c6bdaa2f6469be91b192e7630fe4508b2aa661', 'dark', [(0, 0)]),
    'ice-spirit': ('ice-spirit', '0dce251e2d066ea1605212a9396f220c3eaae5f488e420c916a54013d98c107a', None, []),
    'mineral-centipede': ('mineral-centipede', 'c6fd3a2d400fe0865d4820507c24d97ac755d62cbb239da1f6c0dc02b9899af8', 'light', [(0, 0), (982, 466), (426, 784), (311, 919)]),
    'snowfield-giant': ('snowfield-giant', 'f4e73ce38a948a5a16e554bcd44af7abf30de3eb09edef2fe1cc27f615466ea0', None, []),
    'yeti': ('yeti', '76a3be86ff659d690da8e74fb0ebb5f06aeaf4ef5079286cfe3af50f90ef856c', None, []),
}


def remove_background(image, seeds, tone):
    """Clear only reviewed connected neutral regions, retaining original RGB."""
    if tone not in ('light', 'dark'):
        raise ValueError('Unknown background tone')
    result = image.convert('RGBA')
    pixels = result.load()
    width, height = result.size

    def background(x, y):
        red, green, blue, alpha = pixels[x, y]
        low, high = min(red, green, blue), max(red, green, blue)
        if alpha == 0:
            return False
        if tone == 'light':
            return low >= 225 and high-low <= 12
        return high <= 16 and high-low <= 8

    for x, y in seeds:
        if not (0 <= x < width and 0 <= y < height) or not background(x, y):
            raise ValueError(f'Invalid background seed: {(x, y)}')
    pending = deque()

    def enqueue(x, y):
        if background(x, y):
            red, green, blue, _ = pixels[x, y]
            pixels[x, y] = (red, green, blue, 0)
            pending.append((x, y))

    for x, y in seeds:
        enqueue(x, y)
    while pending:
        x, y = pending.popleft()
        if x: enqueue(x-1, y)
        if x+1 < width: enqueue(x+1, y)
        if y: enqueue(x, y-1)
        if y+1 < height: enqueue(x, y+1)
    return result


def prepare(output, source_dir=SOURCE):
    if output.exists():
        raise FileExistsError(output)
    originals = {name: (source_dir / f'{master}.png').read_bytes()
                 for name, (master, _, _, _) in SELECTION.items()}
    for name, data in originals.items():
        if hashlib.sha256(data).hexdigest() != SELECTION[name][1]:
            raise ValueError(f'Reviewed master hash drift: {name}')
    payloads = {}
    for name, data in originals.items():
        _, _, tone, seeds = SELECTION[name]
        with Image.open(io.BytesIO(data)) as master:
            master.load()
            if tone is None and (master.mode != 'RGBA' or master.getchannel('A').getextrema()[0] != 0):
                raise ValueError(f'Missing true transparency: {name}')
            cleaned = remove_background(master, seeds, tone) if tone else master.copy()
        cleaned.putalpha(cleaned.getchannel('A').point(lambda alpha: 255 if alpha >= 128 else 0))
        bounds = cleaned.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty silhouette: {name}')
        cropped = cleaned.crop(bounds)
        scale = 144 / max(cropped.size)
        width, height = max(1, round(cropped.width*scale)), max(1, round(cropped.height*scale))
        canvas = Image.new('RGBA', (160, 160))
        canvas.alpha_composite(cropped.resize((width, height), Image.Resampling.NEAREST), ((160-width)//2, 152-height))
        buffer = io.BytesIO()
        canvas.save(buffer, format='PNG', optimize=False)
        payloads[name] = buffer.getvalue()
    for name, (master, _, _, _) in SELECTION.items():
        if (source_dir / f'{master}.png').read_bytes() != originals[name]:
            raise ValueError(f'Master changed during preparation: {name}')
    receipt = {
        'originalsUnchanged': True,
        'runtimeAdopted': False,
        'alphaThreshold': 128,
        'selection': {name: {'master': master+'.png', 'sha256': pin, 'backgroundTone': tone, 'backgroundSeeds': seeds}
                      for name, (master, pin, tone, seeds) in SELECTION.items()},
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
