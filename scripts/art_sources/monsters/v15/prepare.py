#!/usr/bin/env python3
"""Export reviewed undead/dungeon sprites without modifying masters or existing output."""

import argparse
from collections import deque
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
SELECTION = {
    "lich": [
        "lich.png",
        "644a4a1d080a36dbdf5061ce9f6dd5a02b74f869523bb9c14aaddc60aac2fecf"
    ],
    "vampire": [
        "vampire-readable.png",
        "da6891cc8b3c34d6406f7802b38e39e152bcceaa420eb562a1ddb36e24120fcd"
    ],
    "skeleton-mage": [
        "skeleton-mage.png",
        "fc23f39527589358991d089a45c58f0ee8f9e7767f8877b835b6b3e73bd2bf9c"
    ],
    "ghost-legion": [
        "ghost-legion.png",
        "3e403c91846f904fd19de4403f1c29fd470972c5432a90b2ffc9ecd08ae440bd"
    ],
    "poison-centipede": [
        "poison-centipede.png",
        "dde6106aa1df6930157a35813ab113a727a30950fe9d5536629262b3aab635c5"
    ],
    "corroded-soldier": [
        "corroded-soldier.png",
        "d14e4fe9c289dcb73571c416060d783c0f04da2272cffccef3a0dc6641393ddd"
    ],
    "sewer-crocodile": [
        "sewer-crocodile.png",
        "f6727368fdaea6c3393030a911acfb580340d27de3624b2e8baa9791615b441a"
    ]
}
VAMPIRE_GAPS = [(0, 0)]


def clean_vampire(source):
    """Remove only reviewed connected neutral background; retain every RGB byte."""
    result = source.convert('RGBA')
    pixels = result.load()
    width, height = result.size

    def background(x, y):
        red, green, blue, alpha = pixels[x, y]
        return alpha != 0 and min(red, green, blue) >= 225 and max(red, green, blue)-min(red, green, blue) <= 12

    for x, y in VAMPIRE_GAPS:
        if not (0 <= x < width and 0 <= y < height) or not background(x, y):
            raise ValueError('Reviewed vampire background seed no longer matches')
    pending = deque()

    def enqueue(x, y):
        if background(x, y):
            pixels[x, y] = (*pixels[x, y][:3], 0)
            pending.append((x, y))

    for x, y in VAMPIRE_GAPS:
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
            if name == 'vampire':
                sprite = clean_vampire(master)
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
        'alphaThreshold': 128, 'vampireBackgroundSeeds': VAMPIRE_GAPS,
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
