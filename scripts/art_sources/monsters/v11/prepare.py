#!/usr/bin/env python3
"""Export reviewed aquatic/river masters; never alter sources or existing outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    'abyss-kraken': 'dc1f21d16d183e2689388bf8a270fab8c63b54b0d90a77978be12f97d7a5d4eb',
    'abyss-leviathan': 'f4aca3da90b7f3f03242aa91b238710373da84a6ce960f7eebf410730198a423',
    'current-sentinel': 'f4e89aa0168ecbfeec9ff60edf87f30e53fc0e48b05924043eb125f8ff52497c',
    'deep-sea-prayer': 'f9d030ec4c2c951bdb862cbc12a2667dead3c70bc6213d5acc09b0c83e3c5fa7',
    'oblivion-naga': '68bfc4e4960c41e6c0e51b71c99be86aa1919cf985c0552814a56bdd3b9d9cac',
    'resentful-dead': 'e7754f6d20e9fa9eab3396f30c437a6f95cabea58190f6f5aa54cf2d7ea3b988',
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
        canvas = Image.new('RGBA', (160, 160))
        canvas.alpha_composite(sprite.resize((width, height), Image.Resampling.NEAREST), ((160-width)//2, 152-height))
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
