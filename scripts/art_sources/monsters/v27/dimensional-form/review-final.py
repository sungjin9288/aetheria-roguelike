"""Render immutable candidate exports at their actual review sizes."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent
receipt = json.loads((BASE / 'exports-reviewed/receipt.json').read_text())
names = list(receipt['exportSha256'])
for start in range(0, len(names), 3):
    sheet = Image.new('RGB', (900, 600), '#171720')
    draw = ImageDraw.Draw(sheet)
    for row, name in enumerate(names[start:start + 3]):
        path = BASE / 'exports-reviewed' / f'{name}.png'
        assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt['exportSha256'][name]
        sprite = Image.open(path)
        draw.text((8, row * 200 + 8), name, fill='white')
        for column, background in enumerate(('#171720', '#f3ece0')):
            x = 190 + column * 355
            draw.rectangle((x, row * 200, x + 354, row * 200 + 199), fill=background)
            for offset, size in ((8, 160), (192, 46), (280, 32)):
                image = sprite.resize((size, size), Image.Resampling.NEAREST)
                sheet.paste(image, (x + offset, row * 200 + 24), image)
    with (BASE / f'review-final-{start // 3 + 1}.png').open('xb') as target:
        sheet.save(target)
gray = Image.new('RGB', (600, 720), '#f3ece0')
draw = ImageDraw.Draw(gray)
for index, name in enumerate(names):
    sprite = Image.open(BASE / 'exports-reviewed' / f'{name}.png')
    monochrome = sprite.convert('L').convert('RGBA')
    monochrome.putalpha(sprite.getchannel('A'))
    x, y = (index % 3) * 200, (index // 3) * 120
    draw.text((x + 4, y + 4), name, fill='#171720')
    for offset, size in ((8, 46), (72, 32)):
        small = monochrome.resize((size, size), Image.Resampling.NEAREST)
        gray.paste(small, (x + offset, y + 35), small)
with (BASE / 'review-final-grayscale.png').open('xb') as target:
    gray.save(target)
print('16 pinned candidates rendered in color and grayscale; masters and runtime unchanged')
