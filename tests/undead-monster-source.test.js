import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v15/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'reviewed undead source preparer is required');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('undead exports preserve eight originals and produce seven deterministic transparent sprites', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
api = runpy.run_path('${script}')
source = Path('scripts/art_sources/monsters/v15/masters')
before = {p.name:p.read_bytes() for p in source.glob('*.png')}
assert len(before) == 8
expected = {'lich','vampire','skeleton-mage','ghost-legion','poison-centipede','corroded-soldier','sewer-crocodile'}
with tempfile.TemporaryDirectory(prefix='aetheria-undead-test-') as directory:
    base = Path(directory)
    first = api['prepare'](base/'first')
    assert first == api['prepare'](base/'second')
    receipt = json.loads(first)
    assert set(receipt['exportSha256']) == expected
    assert receipt['runtimeAdopted'] is False
    for name in expected:
        data = (base/'first'/f'{name}.png').read_bytes()
        assert data == (base/'second'/f'{name}.png').read_bytes()
        assert hashlib.sha256(data).hexdigest() == receipt['exportSha256'][name]
        image = Image.open(base/'first'/f'{name}.png')
        assert image.mode == 'RGBA' and image.size == (160,160)
        alpha = image.getchannel('A'); bounds = alpha.getbbox()
        assert set(alpha.getdata()) == {0,255}
        assert bounds[0]>=8 and bounds[1]>=8 and bounds[2]<=152 and bounds[3]==152, (name,bounds)
        master = Image.open(source/receipt['selection'][name]['master'])
        original = api['clean_vampire'](master) if name == 'vampire' else master
        source_bounds = original.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
        source_ratio = (source_bounds[2]-source_bounds[0])/(source_bounds[3]-source_bounds[1])
        export_ratio = (bounds[2]-bounds[0])/(bounds[3]-bounds[1])
        assert abs(source_ratio-export_ratio)<0.025, (name,source_ratio,export_ratio)
assert before == {p.name:p.read_bytes() for p in source.glob('*.png')}
`);
});

test('vampire extraction clears reviewed background gaps without recoloring or erasing skin and shirt highlights', () => {
    python(`
import runpy
from PIL import Image
api = runpy.run_path('${script}')
source = Image.open('scripts/art_sources/monsters/v15/masters/vampire-readable.png')
clean = api['clean_vampire'](source)
assert clean.getchannel('A').getbbox() is not None
for point in [(0,0),(1253,1253)]: assert clean.getpixel(point)[3] == 0, point
assert clean.convert('RGB').tobytes() == source.tobytes()
# Reviewed face and shirt points are body, not background.
for point in [(620,130),(790,450)]: assert clean.getpixel(point)[3] == 255, point
`);
});

test('undead preparation rejects source drift and existing destinations without overwrites', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare = runpy.run_path('${script}')['prepare']
with tempfile.TemporaryDirectory(prefix='aetheria-undead-reject-') as directory:
    base=Path(directory); output=base/'keep'; output.mkdir()
    (output/'sentinel').write_text('preserve')
    try: prepare(output); raise AssertionError('overwrite accepted')
    except FileExistsError: pass
    assert (output/'sentinel').read_text()=='preserve' and len(list(output.iterdir()))==1
    shutil.copytree('scripts/art_sources/monsters/v15/masters',base/'drift')
    with (base/'drift'/'vampire-readable.png').open('ab') as f: f.write(b'drift')
    try: prepare(base/'rejected',base/'drift'); raise AssertionError('drift accepted')
    except ValueError as e: assert 'hash drift' in str(e)
    assert not (base/'rejected').exists()
`);
});
