#!/usr/bin/env python3
"""Export reviewed machine/laboratory masters; never alter sources or existing outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    'biological-weapon': 'c25ad39237fc1c32d501ffd31bc5c1b375666938818dc64d2463e2ed4f67ba95',
    'closed-circuit-mage-soldier': 'bea8cf1fd3f348a232aaeba841352834ba12bfbb4806b48641dca0726afb3d58',
    'contaminated-researcher': '88d30401bfc2003dd53c342521e965061f5b748eed24d5a76e708eed523d140a',
    'malfunctioning-robot': 'bcb7261ef2a01c9adcb1cea36795c0fe58fea8f6b5299c91d275e1bb08285180',
    'mummy': '94a83a21ff842d23e5295eaf550ccb1d0259ecd5f862adc54538a5f97ad17baa',
    'overloaded-artillery': '7e667fc05b76d8b73926888a433c4371665f6a4fbd7563f5c37d0b66cd31bd7e',
    'runaway-automaton': '581127f3b301326184a51a8b2113e220504e04a528ded422f01d8d248a7b4da8',
    'steam-golem': '0fa4a2cdd1c21c4c9edabc20eb0954c790157113609b96a295b68d02b2fdd356',
    'steel-automaton': 'eebb80b7eb086e9e21fa680d428babc7ed9df4a229cb80e709ab0b7d735f5941',
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
