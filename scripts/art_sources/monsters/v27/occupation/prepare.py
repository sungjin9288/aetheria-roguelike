#!/usr/bin/env python3
"""Export the approved occupation candidates without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "bone-collector": "0fefcb5351146df4d910f5d204915189e9cf87efbda095cb6e7024c7d17f1371",
    "cursed-fisher": "a9f54f0b1229bf9e2d56fe2b47210b2e461bae0d2c88cc9d6722d7389f01fde4",
    "desert-bandit": "38070827eb2e0770b373482ec1f3e3a07e9f280347378cc3308baf5efb194f5a",
    "greedy-merchant": "cf49c6b9620f940a191a2431dd2530f9bf0d49edd857db97c28b4292a687f5f5",
    "river-spirit": "8e29f77a75f6f66b33f20f263d9bdbfda408822714ef0fd8f2feadbfd5ba7fe0",
    "shadow-hunter": "15e0017b306a029741ca3021c6a8b65acc501b44c5251f75a116bb92df8c2a1a",
    "soul-draining-skeleton": "fff16f12aaab74f1341efab066d7c2e09d3fca2e4e391c11cf61ee1f1b27ec37",
    "stormcloud-hunter": "2229a5bc75b6925fec73ee59c70ede3f5833bc068bd1c196da0cab68a6cc63d1",
    "torturer": "be4d6a4eefdd1ed7aa116f9d8de13240052ec951e0156dd542b7fa20e363b6cd",
    "treasure-hunter": "21f325c2825e0200a2af8b016c539e994fec268f1d0bc40445fbdf6b6fe73489",
    "wind-tracker": "3ef871fb111d28a17f0349cc8da48586561c9fcb0ed1db9a63a316035269eb35"
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
