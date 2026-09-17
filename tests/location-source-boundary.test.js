import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('reviewed third-column crops exclude adjacent medallions without clipping their own frame', () => {
    const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts')
import process_location_medallions as art
from PIL import Image

for sheet in art.SOURCE_SHEETS[:3]:
    source = Image.open(art.SOURCE_DIR / sheet.filename)
    original = source.tobytes()
    for index in (2, 6, 10, 14):
        crop = art.remove_connected_background(art.crop_cell(source, sheet, index))
        alpha = crop.getchannel('A')
        assert alpha.crop((crop.width - 12, 0, crop.width, crop.height)).getbbox() is None, (sheet.filename, index, 'neighbor frame leaked')
        bounds = alpha.getbbox()
        assert bounds[2] - bounds[0] >= 250, (sheet.filename, index, 'own frame clipped')
        normalized = art.normalize(crop).getchannel('A')
        solid = normalized.point(lambda value: 255 if value >= 128 else 0).getbbox()
        assert solid[2] - solid[0] >= 88, (sheet.filename, index, 'body shrunk by stray border')
        assert abs((solid[0] + solid[2]) - 96) <= 2, (sheet.filename, index, 'body off center')
    assert source.tobytes() == original
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
