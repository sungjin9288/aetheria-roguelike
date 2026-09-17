#!/usr/bin/env python3
"""Export reviewed void and chaos masters; never alter sources or existing outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "abyss-eye": "d2901a0e758503b0a3ebd63f9dce441cd64317773849f7edb1deebd8d7f52847",
    "dimensional-infantry": "d1054b42da5885e69ce2fda69bf592b3a0b7a37b9c34747eb442bd266319b9ce",
    "dragon-knight": "43654f6bc667c3dc239b4a3210cad3ccd4e48dca9339aa989415940eeaf2aeae",
    "fallen-angel": "d088f942bcff4f85476b4ea529a7f92ea1a19f3624fe43c7cedc028da3a7a4d3",
    "void-beast": "3b10cf51ef593ec3f4316890041b62ae68d9bd7662718e713c5caf9f2ccaca9b",
    "void-bombardier": "51af8e0af22f20adc2c8d7dc4012be1fb207aa602536e375d69df957c1335256",
    "void-fragment": "f9d8edd75fa7a3d48586f9b72943e9c09689a5a0fbaac31c622f7cec20e8d848"
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
