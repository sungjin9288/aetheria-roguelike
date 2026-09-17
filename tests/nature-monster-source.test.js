import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v13/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'reviewed nature source preparer is required');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('nature exports preserve originals and aspect ratio with deterministic bounded binary alpha', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
prepare = runpy.run_path('${script}')['prepare']
source = Path('scripts/art_sources/monsters/v13/masters')
before = {p.name:p.read_bytes() for p in source.glob('*.png')}
names = {'oldwood-golem','flower-golem','wild-griffin'}
with tempfile.TemporaryDirectory(prefix='aetheria-nature-test-') as directory:
    base=Path(directory)
    first=prepare(base/'first')
    assert first==prepare(base/'second')
    receipt=json.loads(first)
    assert set(receipt['exportSha256'])==names and receipt['runtimeAdopted'] is False
    for name in names:
        data=(base/'first'/f'{name}.png').read_bytes()
        assert data==(base/'second'/f'{name}.png').read_bytes()
        assert hashlib.sha256(data).hexdigest()==receipt['exportSha256'][name]
        image=Image.open(base/'first'/f'{name}.png')
        assert image.mode=='RGBA' and image.size==(160,160)
        alpha=image.getchannel('A'); bounds=alpha.getbbox()
        assert set(alpha.getdata())=={0,255}
        assert bounds[0]>=8 and bounds[1]>=8 and bounds[2]<=152 and bounds[3]==152,(name,bounds)
        master=Image.open(source/f'{name}.png')
        original=master.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
        assert abs((original[2]-original[0])/(original[3]-original[1])-(bounds[2]-bounds[0])/(bounds[3]-bounds[1]))<0.025
assert before=={p.name:p.read_bytes() for p in source.glob('*.png')}
`);
});

test('nature preparation refuses existing output and source drift before creating files', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare=runpy.run_path('${script}')['prepare']
with tempfile.TemporaryDirectory(prefix='aetheria-nature-reject-') as directory:
    base=Path(directory); output=base/'existing'; output.mkdir()
    (output/'sentinel').write_text('preserve')
    try: prepare(output); raise AssertionError('overwrite accepted')
    except FileExistsError: pass
    assert (output/'sentinel').read_text()=='preserve' and len(list(output.iterdir()))==1
    shutil.copytree('scripts/art_sources/monsters/v13/masters',base/'drift')
    with (base/'drift'/'oldwood-golem.png').open('ab') as f:f.write(b'drift')
    try: prepare(base/'rejected',base/'drift'); raise AssertionError('drift accepted')
    except ValueError as e: assert 'hash drift' in str(e)
    assert not (base/'rejected').exists()
`);
});
