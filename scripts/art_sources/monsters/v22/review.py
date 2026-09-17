"""Render immutable candidate exports at their actual review sizes."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent
receipt = json.loads((BASE / 'exports/receipt.json').read_text())
names = list(receipt['exportSha256'])
for start in range(0, len(names), 3):
    sheet = Image.new('RGB', (900, 600), '#171720')
    draw = ImageDraw.Draw(sheet)
    for row, name in enumerate(names[start:start + 3]):
        path = BASE / 'exports' / f'{name}.png'
        assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt['exportSha256'][name]
        sprite = Image.open(path)
        draw.text((8, row * 200 + 8), name, fill='white')
        for column, background in enumerate(('#171720', '#f3ece0')):
            x = 190 + column * 355
            draw.rectangle((x, row * 200, x + 354, row * 200 + 199), fill=background)
            for offset, size in ((8, 160), (192, 46), (280, 32)):
                image = sprite.resize((size, size), Image.Resampling.NEAREST)
                sheet.paste(image, (x + offset, row * 200 + 24), image)
    with (BASE / f'review-{start // 3 + 1}.png').open('xb') as target:
        sheet.save(target)
print('7 pinned candidates rendered; masters and runtime unchanged')
