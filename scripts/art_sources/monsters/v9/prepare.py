#!/usr/bin/env python3
"""Export reviewed volcanic masters; never alter sources or existing outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    'fire-bat': 'bcb56afcaae47d7f28ca17ca4c3fef8f57fd93635e3b47aa5adb1d7bd21e21d4',
    'fire-golem': 'd28f2a0c6d3683eda179d9ad27c2ebfae76c1751aea28fe70b0b638939ea0280',
    'fire-spirit': '83bb89253921ae14d5f34dd71376f70c4b574ee5b50da598b7bb5ca4c377afcd',
    'lava-giant': '35d5f0572806b1ff78b2ff06d1dbb4e300c89d49dacba0d5fe28a1a7dc3e782e',
    'lava-golem': '636632f58ee1ac132642f47077162755d68c2243d9c985e6ff28f93ef7752f9e',
    'lava-spirit': 'c516d0cdcdd5788f475a0d42f054ecca1a417a97ccd78eef6849310580fa4c7f',
    'lava-turtle': '64541f9f279510e6ed27cfae89103ebef1f72a99c2b01b27338c4b8ea840748a',
    'magma-slime': '226352f16031764ff69133253728465aba1095ea5ec1fcfadc5c47ebe873284a',
    'magma-spirit': '2b6a350545f27e35da2ab003a6289abc72569c03a919a03566e2f4b727710d01',
    'volcanic-spirit': '9afd2c71d3afd3241d3da1747b5f855fbb6df1d08f5d33da6518228b71160ec2',
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
