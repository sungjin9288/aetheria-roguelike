#!/usr/bin/env python3
"""Export the approved dimensional-form candidates without changing masters or prior outputs."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent / 'masters'
PINS = {
    "aether-assault": "9c4866c6c72ed301e0f1eef4b9a5fd2b0c0315862867358647ee3f9ceeb2e2d2",
    "aether-wanderer": "a64e27ed42c56e7e53c50a9c0458518255ef512b99a3443ee6557d1966976049",
    "chaos-follower": "e9ab58a0b30a1df046a22559ae9260323d181fb99d86062c57621f70748985d7",
    "chaos-incarnation": "edac63d8c0470f70b46a9f51bd010ae91b6b6bc83af326534edfa9ccbae1ff1b",
    "collapsed-guardian-floating": "753d2f486ba9dec530029d9c35f889ecbaaf7018a3294b1932c8e2915f37f586",
    "collapsed-guardian-grounded": "3ad96949d2403e18a7c4bf6b21a842036bffbb5b270e6ea18cf5a9f13d465cfd",
    "dimension-commander": "79e4fb40d7c6c4ed41e8c5c3a8ce98c2d53e56b6a08d1c3ac15c9d7921c302da",
    "dimension-devourer": "a38489954a049dbd42df3b147e9734a9db16d3d7dfa9090d0df7410cf39b4cfb",
    "dimension-splitter": "de236a232c4d7311e2f342a102d4d489b36039b6cab38b56ae4cde6653b8168f",
    "dimension-wanderer": "14c9d25b7d31e05a5dac491fdec06409d6f3cc65e61c8369001b4dfacfa5a630",
    "nihil-executor": "fce130c065f6ec22f3ffd8ab1baf8feaeae5638e61b48e37acd47942f632c2ce",
    "nihility-executor": "65df7c2132e2152ab0ab31a94c2b14aa623c26b041242ac5d5906dec2e260a69",
    "space-breaker": "500189749e05d8ce04734d1e25b898a798b4741634fd3fae321f00d0ddb0fb34",
    "void-executor": "6d99efafad7d915d6a049a50a120a3438df46cf554bc65df4db1fc3e4493194b",
    "void-observer": "dc44b84c57a0790ed29f7bb11413193a20f09cc064c610cb57c233f747643ea5",
    "void-sentry": "b14ae867721cc924ab4f976072926d06fa206d73dafc6552d81b2f80f2839e09"
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
