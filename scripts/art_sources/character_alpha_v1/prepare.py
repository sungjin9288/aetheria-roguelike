#!/usr/bin/env python3
"""Remove reviewed aperture backgrounds from copies of pinned character masters."""

from collections import deque
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SCRIPTS))
from process_character_art import normalize_character

SELECTION = {
    'ranger': {
        'sha256': '6adaecfe4a7e16a48d4afe802b786050d10ca853a9c8d3b80ca134addd842a8f',
        'seeds': [(837, 412), (834, 736), (809, 880)],
    },
    'hunt-lord': {
        'sha256': '8afa1b80e71972f81fc2445054f40ff947fc7d584e24d7f76e27be45b31f1e9b',
        'seeds': [(949, 444), (886, 696), (976, 675), (786, 1017), (890, 846)],
    },
    'mage': {
        'sha256': '40960d0e9b9fb3803db60906326509d81357df2260d4d90b3f7b77909c5f01a9',
        'seeds': [(316, 442), (438, 810), (477, 953)],
    },
    'archmage': {
        'sha256': '380c3eaab7be17e5417f45be1d9a9675be858518e6e357749096a2a2efc66fde',
        'seeds': [(273, 247), (290, 499), (995, 493), (1018, 492)],
    },
    'grand-mage': {
        'sha256': 'af8614afe2550fbcbd51697e2a1934e7720d422cbf72aae7ccd8dc03ff1a005e',
        'seeds': [(838, 313), (264, 528), (965, 563), (845, 459), (498, 471),
                  (240, 230), (394, 604), (952, 536), (411, 540), (370, 270),
                  (948, 508), (326, 203), (359, 194), (462, 489), (994, 330),
                  (385, 555), (252, 327), (985, 520), (188, 545), (378, 386)],
    },
    'cleric': {
        'sha256': '735134f201e1667e1dc7e07f1fee1a54b45af6f1f0c8dc338e70228f3f861368',
        'seeds': [(392, 402), (830, 398), (914, 420), (944, 512), (854, 496),
                  (271, 300), (962, 372), (970, 533), (811, 352), (975, 359),
                  (792, 356), (858, 564)],
    },
    'paladin': {
        'sha256': '5b271f68b480d744b70bb9df2e89524aae296f99080208ec4762208b6a65f63f',
        'seeds': [(802, 300), (946, 294), (939, 238), (943, 364), (820, 226),
                  (951, 218), (776, 331), (857, 386), (817, 200)],
    },
    'shaman': {
        'sha256': '26d6a4f8e4e9d353dde6aa809a67f6e97df0d34794ef384a3b4ed0916a87bf87',
        'seeds': [(256, 320), (478, 1002), (422, 811), (222, 259), (315, 550),
                  (219, 346), (303, 423)],
    },
}


def correct_apertures(source, seeds):
    result = source.convert('RGBA')
    pixels = result.load()
    width, height = result.size

    def matches(x, y):
        red, green, blue, alpha = pixels[x, y]
        return alpha >= 128 and min(red, green, blue) >= 225 and max(red, green, blue) - min(red, green, blue) <= 12

    for x, y in seeds:
        if not (0 <= x < width and 0 <= y < height) or not matches(x, y):
            raise ValueError(f'Invalid aperture seed: {(x, y)}')

    pending = deque()

    def enqueue(x, y):
        if matches(x, y):
            red, green, blue, _ = pixels[x, y]
            pixels[x, y] = (red, green, blue, 0)
            pending.append((x, y))

    for x, y in seeds:
        enqueue(x, y)
    while pending:
        x, y = pending.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)
    return result


def prepare(output, source_dir=Path(__file__).resolve().parent / 'originals'):
    if output.exists():
        raise FileExistsError(f'Output already exists: {output}')
    originals = {key: (source_dir / f'{key}.png').read_bytes() for key in SELECTION}
    for key, data in originals.items():
        if hashlib.sha256(data).hexdigest() != SELECTION[key]['sha256']:
            raise ValueError(f'Reviewed source hash drift: {key}')

    payloads = {}
    for key, data in originals.items():
        with Image.open(io.BytesIO(data)) as image:
            corrected = correct_apertures(image, SELECTION[key]['seeds'])
        runtime, _ = normalize_character(corrected, width=768, height=768, foot_baseline=708)
        for folder, image in [('sources', corrected), ('runtime', runtime)]:
            buffer = io.BytesIO()
            image.save(buffer, format='PNG', optimize=False)
            payloads[f'{folder}/{key}.png'] = buffer.getvalue()

    for key, data in originals.items():
        if (source_dir / f'{key}.png').read_bytes() != data:
            raise ValueError(f'Source changed during preparation: {key}')
    receipt = {
        'runtimeAdopted': False,
        'originalsUnchanged': True,
        'selection': SELECTION,
        'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()},
    }
    output.mkdir(exist_ok=False)
    for folder in ('sources', 'runtime'):
        (output / folder).mkdir()
    for name, data in payloads.items():
        with (output / name).open('xb') as target:
            target.write(data)
    with (output / 'receipt.json').open('x') as target:
        json.dump(receipt, target, indent=2, sort_keys=True)
        target.write('\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    print(json.dumps(prepare(parser.parse_args().output), indent=2, sort_keys=True))
