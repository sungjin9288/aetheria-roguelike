import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v8/prepare.py';

function runPython(body) {
    assert.ok(existsSync(script), 'source-pinned cave/snow preparation is required');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('compact elf extraction clears connected black background but preserves plum outline and white eyes', () => {
    runPython(`
import runpy
from PIL import Image
remove = runpy.run_path('${script}')['remove_background']
source = Image.open('scripts/art_sources/monsters/v8/masters/dark-elf-compact.png').convert('RGBA')
before = source.tobytes()
result = remove(source, [(0,0)], 'dark')
for point in [(0,0),(100,100),(625,200),(620,900)]:
    assert result.getpixel(point)[3] == 0, point
for point in [(600,311),(570,590),(480,810),(790,736)]:
    assert result.getpixel(point) == source.getpixel(point), point
assert source.tobytes() == before
assert result.convert('RGB').tobytes() == source.convert('RGB').tobytes()
try:
    remove(source, [(600,311)], 'dark')
    raise AssertionError('plum outline seed accepted')
except ValueError:
    pass
`);
});

test('mineral centipede extraction removes reviewed gaps without globally deleting mineral highlights', () => {
    runPython(`
import runpy
from PIL import Image
remove = runpy.run_path('${script}')['remove_background']
source = Image.open('scripts/art_sources/monsters/v8/masters/mineral-centipede.png').convert('RGBA')
before = source.tobytes()
seeds = [(0,0),(982,466),(426,784),(311,919)]
result = remove(source, seeds, 'light')
for point in seeds: assert result.getpixel(point)[3] == 0, point
assert result.getpixel((740,298)) == source.getpixel((740,298))
assert source.tobytes() == before
assert result.convert('RGB').tobytes() == source.convert('RGB').tobytes()
`);
});

test('nine-monster preparation is deterministic, source-preserving and refuses overwrite or preimage drift', () => {
    runPython(`
import hashlib, json, runpy, shutil, tempfile
from pathlib import Path
from PIL import Image
prepare = runpy.run_path('${script}')['prepare']
source = Path('scripts/art_sources/monsters/v8/masters')
before = {p.name: p.read_bytes() for p in source.glob('*.png')}
names = {'bat-swarm','cave-troll','crystal-golem','crystal-spirit','dark-elf','ice-spirit','mineral-centipede','snowfield-giant','yeti'}
with tempfile.TemporaryDirectory(prefix='aetheria-cave-snow-test-') as directory:
    base = Path(directory)
    first = json.loads(prepare(base/'first'))
    second = json.loads(prepare(base/'second'))
    assert first == second
    assert set(first['exportSha256']) == names
    assert first['runtimeAdopted'] is False
    for name in names:
        data = (base/'first'/f'{name}.png').read_bytes()
        assert data == (base/'second'/f'{name}.png').read_bytes()
        assert hashlib.sha256(data).hexdigest() == first['exportSha256'][name]
        with Image.open(base/'first'/f'{name}.png') as image:
            assert image.size == (160,160) and image.mode == 'RGBA'
            bounds = image.getchannel('A').getbbox()
            assert bounds[0] >= 8 and bounds[2] <= 152 and bounds[1] >= 8 and bounds[3] == 152, (name,bounds)
            assert set(image.getchannel('A').getdata()) == {0,255}
    try:
        prepare(base/'first')
        raise AssertionError('existing output overwritten')
    except FileExistsError:
        pass
    shutil.copytree(source, base/'drift')
    with (base/'drift'/'yeti.png').open('ab') as file: file.write(b'drift')
    try:
        prepare(base/'rejected', base/'drift')
        raise AssertionError('changed master accepted')
    except ValueError:
        pass
    assert not (base/'rejected').exists()
assert before == {p.name: p.read_bytes() for p in source.glob('*.png')}
`);
});
