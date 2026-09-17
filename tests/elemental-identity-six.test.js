import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v25/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'elemental-six preparer must exist');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('elemental six preserves masters and exports deterministic bounded RGBA sprites', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v25/masters')
names={'lightning-golem','corroded-golem','ice-knight','lake-guardian','fire-wyvern','fire-drake'}
before={p.name:p.read_bytes() for p in source.glob('*.png')}
assert set(before)=={name+'.png' for name in names}
with tempfile.TemporaryDirectory(prefix='aetheria-elemental-six-') as directory:
    base=Path(directory)
    first=prepare(base/'one'); second=prepare(base/'two')
    assert first==second
    receipt=json.loads(first)
    assert set(receipt['exportSha256'])==names and receipt['runtimeAdopted'] is False
    for name in names:
        data=(base/'one'/f'{name}.png').read_bytes()
        assert data==(base/'two'/f'{name}.png').read_bytes()
        assert hashlib.sha256(data).hexdigest()==receipt['exportSha256'][name]
        image=Image.open(base/'one'/f'{name}.png')
        assert image.mode=='RGBA' and image.size==(160,160)
        alpha=image.getchannel('A'); bounds=alpha.getbbox()
        assert set(alpha.getdata())=={0,255}
        assert bounds[0]>=8 and bounds[1]>=8 and bounds[2]<=152 and bounds[3]==152,(name,bounds)
assert before=={p.name:p.read_bytes() for p in source.glob('*.png')}
`);
});

test('elemental six rejects source drift and existing outputs before writes', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v25/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-elemental-six-reject-') as directory:
    base=Path(directory); output=base/'existing'; output.mkdir()
    (output/'sentinel').write_text('preserve')
    try: prepare(output); raise AssertionError('overwrite accepted')
    except FileExistsError: pass
    assert (output/'sentinel').read_text()=='preserve' and len(list(output.iterdir()))==1
    for master in source.glob('*.png'):
        drift=base/master.stem; shutil.copytree(source,drift)
        with (drift/master.name).open('ab') as target: target.write(b'drift')
        rejected=base/(master.stem+'-rejected')
        try: prepare(rejected,drift); raise AssertionError('drift accepted')
        except ValueError as error: assert 'hash drift' in str(error)
        assert not rejected.exists()
`);
});

test('elemental six rejects opaque or empty candidates without output', () => {
    python(`
import hashlib, runpy, shutil, tempfile
from pathlib import Path
from PIL import Image
module=runpy.run_path('${script}'); prepare=module['prepare']
source=Path('scripts/art_sources/monsters/v25/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-elemental-six-alpha-') as directory:
    base=Path(directory)
    for mode, color, message in [('RGB',(1,2,3),'transparency'),('RGBA',(0,0,0,0),'Empty silhouette')]:
        candidate=base/mode; shutil.copytree(source,candidate)
        path=candidate/'fire-drake.png'; Image.new(mode,(16,16),color).save(path)
        original=module['PINS']['fire-drake']
        module['PINS']['fire-drake']=hashlib.sha256(path.read_bytes()).hexdigest()
        output=base/(mode+'-output')
        try: prepare(output,candidate); raise AssertionError('invalid alpha accepted')
        except ValueError as error: assert message in str(error)
        finally: module['PINS']['fire-drake']=original
        assert not output.exists()
`);
});
