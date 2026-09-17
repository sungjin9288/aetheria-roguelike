#!/usr/bin/env python3
"""Export the retained identity batch without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "aether-absorber": "e95b5885e41f65e5e6b9de6485b7188cbb041dde16e27fb517bb966a38327c9b",
    "aether-residue": "041b145fb928f71f501a221f2875074691687196f892f69dda89aca14cd72f71",
    "current-tracker": "c0dc9f2b752e75498c7e322571d050ef69aaa786a78656eabe01014340e3ebb5",
    "dark-priest": "253a5bf32786fecf4f0c4f7b6412e63bbbdb8e97fa4132fe8c72a7485a07381d",
    "dead-priest": "d15b243fda0aa09e674431ef78c7999a8ee398de140c66216fe38df51544169b",
    "fire-lizard": "8d571d1e08ed5754679f7daa423e831b0fb641e5ebbab0c50753e3fee4bd2664",
    "flame-lizard": "861a1b2696f47817820165332ab196e5d5f6ba0a03b875d21b7d22e817e4f2f2",
    "mutant-specimen": "830112072e131f9ef96d6c4c7dde72487186246b735ec2ef1b187bfe1b1efdd1",
    "undead-mage": "47ba74a1fd55f8c03769f5afc4994c0edc446ec947d93a3e66ec9a2918686f27",
    "volcanic-lizard": "7094ec1860420253003f698438a1475cc316248b2813f1d563777e41615b6c3c"
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
