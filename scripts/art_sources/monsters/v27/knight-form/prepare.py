#!/usr/bin/env python3
"""Export the approved knight-form candidates without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "cursed-knight": "9a9da893dc2d877c3397207edff40d5dc4cb42ff2b50ba908027f1b2984f0826",
    "death-knight": "ef1c9259cbfb8a71a6977f83bdc491fd52181f6695255d0e071e2f6ed7fb6057",
    "doom-knight": "ea3b689a6ccea9a740951051985c5ac7042f933ab7539c1c6db89291693c2b91",
    "drowned-knight": "419a7b65421593eb998ad639bc5e661e7bcb96c15a74cc03390124e1d7b63494",
    "fallen-champion": "98b3290def08f42de72d9f2a86cf8ad69378089dbb542d4b108720a697f90c0e",
    "fallen-knight": "62dc9615dffd337b98dcfc339242cb201a3e44b701de6ed15989d5ab5dc705a1",
    "ghost-knight": "82a9a50a48ccab07d00731e710ece75a554cc4516ed7bef8899cef08dd15beab",
    "hell-gatekeeper": "9e040cbb538a9faa315c5852a6b688c064ec222faa2a3bd48d2b123c87c44c47",
    "void-knight": "abf4d44118bbd7e50f0bbaeda16bc7bc7141fa3af025f65f443b9427eb6de438",
    "wraith-commander": "b62c35675f7aa93a641ac045f77a259a5787df012e1a5298b431d1dbe39f768f",
    "wraith-knight": "92aca73172845bf58643e71b4541729bc9abf99e62445950fd98dd06fef0b5e9"
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
