#!/usr/bin/env python3
"""Export reviewed sky/storm sprites without modifying masters or existing output."""

import argparse
from collections import deque
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
SELECTION = {
    "cloud-spirit": [
        "cloud-spirit.png",
        "8548dd8cc010338e7e371479c4941dcc688fcb791bdd21d969323762218885c8"
    ],
    "gale-elemental": [
        "gale-elemental.png",
        "535ffcb7b9ae5fcf3221712c40f8c0806593d6b74f47577808c202c0f6123bb9"
    ],
    "light-crystal": [
        "light-crystal.png",
        "457c05d678d5b6ab09aca66a9808a1d60e0ef358df93ee36520ff859b5ecbab6"
    ],
    "lightning-spirit": [
        "lightning-spirit.png",
        "62495b17ee46eff19669555b8eba8c0e0307a665885519b75aef821a1056a271"
    ],
    "nebula-watcher": [
        "nebula-watcher.png",
        "324ce8a80f485b804a33ea10b0ac636ae8e8298cd1645f2f6c9991268e0c922a"
    ],
    "sky-guardian-bird": [
        "sky-guardian-bird.png",
        "ba59268bda3f12bc9a13bd6cb36b349cf0ea7fde2d79d4fd0c3138bb4d9a2d9d"
    ],
    "sky-spirit": [
        "sky-spirit.png",
        "50d304d5fca75a5e2eb551f6d0aeed37e615ebe52666f0ca989d5cf2e982d2b0"
    ],
    "storm-falcon": [
        "storm-falcon.png",
        "3a2d87091728a0ffb117d1bdbd1e917df0e55ee9c44341403cd561a0ede2e0b9"
    ],
    "storm-griffin": [
        "storm-griffin.png",
        "79e964b99b4cb20e920815919197e3d7195153a011bff6858b2dc5cd8879c804"
    ],
    "storm-siren": [
        "storm-siren-compact.png",
        "f9b3cbe97030ceef1470996023e54b8854622fb73e24203922d9884879d4852c"
    ],
    "wind-spirit": [
        "wind-spirit.png",
        "b8bae5b2420653e71e7592d04530c730841f22f0d85761c8775f967bd39081ff"
    ]
}
SIREN_GAPS = [(0, 0), (806, 675), (720, 811), (506, 409)]


def clean_siren(source):
    """Remove only reviewed connected neutral background; retain every RGB byte."""
    result = source.convert('RGBA')
    pixels = result.load()
    width, height = result.size

    def background(x, y):
        red, green, blue, alpha = pixels[x, y]
        return alpha != 0 and min(red, green, blue) >= 225 and max(red, green, blue)-min(red, green, blue) <= 12

    for x, y in SIREN_GAPS:
        if not (0 <= x < width and 0 <= y < height) or not background(x, y):
            raise ValueError('Reviewed siren background seed no longer matches')
    pending = deque()

    def enqueue(x, y):
        if background(x, y):
            pixels[x, y] = (*pixels[x, y][:3], 0)
            pending.append((x, y))

    for x, y in SIREN_GAPS:
        enqueue(x, y)
    while pending:
        x, y = pending.popleft()
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)
    return result


def prepare(output, source_dir=SOURCE):
    if output.exists():
        raise FileExistsError(output)
    originals = {name: (source_dir / filename).read_bytes() for name, (filename, _) in SELECTION.items()}
    for name, data in originals.items():
        if hashlib.sha256(data).hexdigest() != SELECTION[name][1]:
            raise ValueError(f'Reviewed master hash drift: {name}')
    payloads = {}
    for name, data in originals.items():
        with Image.open(io.BytesIO(data)) as master:
            master.load()
            if name == 'storm-siren':
                sprite = clean_siren(master)
            else:
                if master.mode != 'RGBA' or master.getchannel('A').getextrema()[0] != 0:
                    raise ValueError(f'Missing true transparency: {name}')
                sprite = master.copy()
        sprite.putalpha(sprite.getchannel('A').point(lambda alpha: 255 if alpha >= 128 else 0))
        bounds = sprite.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty silhouette: {name}')
        sprite = sprite.crop(bounds)
        scale = 144 / max(sprite.size)
        width, height = max(1, round(sprite.width*scale)), max(1, round(sprite.height*scale))
        canvas = Image.new('RGBA', (160,160))
        canvas.alpha_composite(sprite.resize((width,height), Image.Resampling.NEAREST), ((160-width)//2,152-height))
        buffer = io.BytesIO()
        canvas.save(buffer, format='PNG', optimize=False)
        payloads[name] = buffer.getvalue()
    for name, (filename, _) in SELECTION.items():
        if (source_dir / filename).read_bytes() != originals[name]:
            raise ValueError(f'Master changed during preparation: {name}')
    receipt = json.dumps({
        'runtimeAdopted': False, 'originalsUnchanged': True,
        'alphaThreshold': 128, 'sirenBackgroundSeeds': SIREN_GAPS,
        'selection': {name: {'master': filename, 'sha256': pin} for name, (filename,pin) in SELECTION.items()},
        'exportSha256': {name: hashlib.sha256(data).hexdigest() for name,data in payloads.items()},
    }, indent=2, sort_keys=True) + '\n'
    output.mkdir(exist_ok=False)
    for name, data in payloads.items():
        with (output / f'{name}.png').open('xb') as target:
            target.write(data)
    with (output / 'receipt.json').open('x') as target:
        target.write(receipt)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    print(prepare(parser.parse_args().output), end='')

