import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v12/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'reviewed sky source preparer is required');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('sky exports preserve thirteen originals and produce eleven deterministic transparent sprites', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
api = runpy.run_path('${script}')
source = Path('scripts/art_sources/monsters/v12/masters')
before = {p.name:p.read_bytes() for p in source.glob('*.png')}
assert len(before) == 13
expected = {'sky-guardian-bird','storm-griffin','storm-falcon','storm-siren','light-crystal','gale-elemental','cloud-spirit','wind-spirit','lightning-spirit','nebula-watcher','sky-spirit'}
with tempfile.TemporaryDirectory(prefix='aetheria-sky-test-') as directory:
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
assert before == {p.name:p.read_bytes() for p in source.glob('*.png')}
`);
});

test('siren extraction clears reviewed background gaps without recoloring or erasing feather highlights', () => {
    python(`
import runpy
from PIL import Image
api = runpy.run_path('${script}')
source = Image.open('scripts/art_sources/monsters/v12/masters/storm-siren-compact.png')
clean = api['clean_siren'](source)
assert clean.getchannel('A').getbbox() == (284,246,987,1008)
for point in [(0,0),(806,675),(720,811),(506,409)]: assert clean.getpixel(point)[3] == 0, point
assert clean.convert('RGB').tobytes() == source.tobytes()
# A known pale feather component is body, not a background hole.
for point in [(326,707),(850,830),(637,656)]: assert clean.getpixel(point)[3] == 255, point
`);
});

test('sky preparation rejects source drift and existing destinations without overwrites', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare = runpy.run_path('${script}')['prepare']
with tempfile.TemporaryDirectory(prefix='aetheria-sky-reject-') as directory:
    base=Path(directory); output=base/'keep'; output.mkdir()
    (output/'sentinel').write_text('preserve')
    try: prepare(output); raise AssertionError('overwrite accepted')
    except FileExistsError: pass
    assert (output/'sentinel').read_text()=='preserve' and len(list(output.iterdir()))==1
    shutil.copytree('scripts/art_sources/monsters/v12/masters',base/'drift')
    with (base/'drift'/'storm-siren-compact.png').open('ab') as f: f.write(b'drift')
    try: prepare(base/'rejected',base/'drift'); raise AssertionError('drift accepted')
    except ValueError as e: assert 'hash drift' in str(e)
    assert not (base/'rejected').exists()
`);
});
