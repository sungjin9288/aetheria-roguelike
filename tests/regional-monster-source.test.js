import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('seeded background extraction preserves enclosed highlights and source pixels', () => {
    const result = spawnSync('python3', ['-c', `
import runpy
from PIL import Image
remove = runpy.run_path('scripts/art_sources/monsters/v7/prepare.py')['remove_background']
source = Image.new('RGBA', (9,9), (245,245,245,255))
for y in range(2,7):
    for x in range(2,7): source.putpixel((x,y),(30,50,80,255))
source.putpixel((3,3),(255,255,255,255))
source.putpixel((5,5),(245,245,245,255))
before = source.tobytes()
result = remove(source, [(0,0),(5,5)])
assert result.getpixel((0,0))[3] == 0
assert result.getpixel((5,5))[3] == 0
assert result.getpixel((3,3)) == (255,255,255,255)
assert result.getpixel((2,2)) == source.getpixel((2,2))
assert source.tobytes() == before
try:
    remove(source, [(2,2)])
    raise AssertionError('body-colored seed was accepted')
except ValueError:
    pass
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('reviewed harpy mask removes feather gaps without erasing its white eye', () => {
    const result = spawnSync('python3', ['-c', `
import runpy
from PIL import Image
module = runpy.run_path('scripts/art_sources/monsters/v7/prepare.py')
source = Image.open('scripts/art_sources/monsters/v7/masters/harpy-compact-candidate.png').convert('RGBA')
before = source.tobytes()
result = module['remove_background'](source, module['SELECTION']['harpy'][2])
assert min(source.getpixel((540,455))[:3]) >= 225
assert result.getpixel((540,455)) == source.getpixel((540,455))
for point in [(0,0),(560,817),(549,800),(426,426),(460,762),(774,527)]:
    assert result.getpixel(point)[3] == 0, point
assert source.tobytes() == before
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
