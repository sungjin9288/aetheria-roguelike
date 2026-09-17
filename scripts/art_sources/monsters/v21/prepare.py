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
    "void-proxy": "a5fcadf9bb0d9e1084e914c8b4fc5c04a51fd0e5ca30993574172a7465d8ab55",
    "infinite-avatar": "855b3650450e77ea99c18ae2432ad97f58c1fd45417be13abedec316c59685c2",
    "aether-judge": "1919abb785d3c1af9a2a963edb45a81f22ada43cbda0a4c527a35b92e05cf5f3",
    "spring-queen": "e92ad3c62856edaca073957d3cf43f3a169b9b96c5f43bdd7cd3b23c61da8ad3",
    "guardian-apostle": "50b3c345149ae13b27644172e5a1102ab4f782abe9d8d0e6dcd3aa249230b7af",
    "aether-giant": "de80e26b88b04ee67f153290c3e923b9f7c7c4908a4ef52a93232122b89a3f3a",
    "sewer-queen": "c6b605a25082157999ce89714311ba5ae53e0df9b400d2fdb9f0d21237c9cf3f",
    "chaos-guardian": "aacbc4cf45a9e60c65b6e9b07abdc805ef664bbe358a5dbdf65a40e2e4bb11f7"
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
