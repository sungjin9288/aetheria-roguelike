import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v9/prepare.py';
function runPython(body) {
    assert.ok(existsSync(script), 'source-pinned volcanic preparation is required');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('ten volcanic exports preserve masters, aspect ratio, binary alpha and deterministic bytes', () => {
    runPython(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
prepare = runpy.run_path('${script}')['prepare']
source = Path('scripts/art_sources/monsters/v9/masters')
before = {p.name: p.read_bytes() for p in source.glob('*.png')}
names = {'fire-bat','fire-golem','fire-spirit','lava-giant','lava-golem','lava-spirit','lava-turtle','magma-slime','magma-spirit','volcanic-spirit'}
with tempfile.TemporaryDirectory(prefix='aetheria-volcanic-test-') as directory:
    base = Path(directory)
    first = prepare(base/'first')
    assert first == prepare(base/'second')
    receipt = json.loads(first)
    assert set(receipt['exportSha256']) == names
    assert receipt['runtimeAdopted'] is False
    for name in names:
        data = (base/'first'/f'{name}.png').read_bytes()
        assert data == (base/'second'/f'{name}.png').read_bytes()
        assert hashlib.sha256(data).hexdigest() == receipt['exportSha256'][name]
        image = Image.open(base/'first'/f'{name}.png')
        assert image.size == (160,160) and image.mode == 'RGBA'
        alpha = image.getchannel('A')
        bounds = alpha.getbbox()
        assert bounds[0] >= 8 and bounds[1] >= 8 and bounds[2] <= 152 and bounds[3] == 152, (name,bounds)
        assert set(alpha.getdata()) == {0,255}
        master = Image.open(source/f'{name}.png')
        original_bounds = master.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
        expected_ratio = (original_bounds[2]-original_bounds[0]) / (original_bounds[3]-original_bounds[1])
        actual_ratio = (bounds[2]-bounds[0]) / (bounds[3]-bounds[1])
        assert abs(expected_ratio-actual_ratio) < 0.025, (name, expected_ratio, actual_ratio)
    assert Image.open(source/'lava-spirit.png').size == (1214,1295)
assert before == {p.name: p.read_bytes() for p in source.glob('*.png')}
`);
});

test('volcanic preparation refuses existing output and source drift before writing any output', () => {
    runPython(`
import runpy, shutil, tempfile
from pathlib import Path
prepare = runpy.run_path('${script}')['prepare']
source = Path('scripts/art_sources/monsters/v9/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-volcanic-reject-') as directory:
    base = Path(directory)
    output = base/'existing'
    output.mkdir()
    (output/'keep.txt').write_text('preserve')
    try:
        prepare(output)
        raise AssertionError('existing output overwritten')
    except FileExistsError:
        pass
    assert list(output.iterdir()) == [output/'keep.txt']
    assert (output/'keep.txt').read_text() == 'preserve'
    shutil.copytree(source, base/'drift')
    with (base/'drift'/'lava-spirit.png').open('ab') as file: file.write(b'drift')
    try:
        prepare(base/'rejected', base/'drift')
        raise AssertionError('changed source accepted')
    except ValueError as error:
        assert 'hash drift' in str(error)
    assert not (base/'rejected').exists()
`);
});
