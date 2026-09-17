#!/usr/bin/env python3
"""Export the approved boss-body batch without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    'void-judge': '1b7591fa6732636e10e182f5dda832f579516ea87bb6ace713c8fdeb19232f57',
    'rift-commander': '45d67ab2e0a5fd4374c3ae912352a5db5fa005c890b9465ebb82b68432635388',
    'annihilation-apostle': '352aae12da93aafe640409043175ee0b20eccefbc840f6189e701b5b7c16cb2e',
    'abyss-sentinel': 'cb4b512819d4a64ae2eb7b792760285c66af8c8de17f8c7673ac7346412e0b57',
    'resentful-champion': 'e01f2bb2b6cbce7b72720d0b2cf8099572a0e3e6127ae8c3c25b0202e683464e',
    'outpost-commander': 'da47802e1a4b00d4eb656fa4d3852abbe2ec2d588aa622fc991ad540bec3ba2b',
    'doom-knight': '9a64cc02481e84c5de2fb4c8a107677b04d68cd63800e97b4ff5f2801183b5ce',
    'dimension-splitter': '57393882144fa27d94b1627109ce1a2357a3ddc1941605c2783f5afc51fcbfe5',
    'void-herald': '0344e96d441c783f811612fcf35a2af7b1854dc981edff7ecdfa2b626a8e4446',
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
