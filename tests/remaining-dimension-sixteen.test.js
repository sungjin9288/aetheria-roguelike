import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v27/dimensional-form/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'remaining-dimension-sixteen preparer must exist');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('remaining dimension sixteen preserves masters and exports deterministic bounded RGBA sprites', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v27/dimensional-form/masters')
names={'space-breaker','void-sentry','void-executor','void-observer','collapsed-guardian-grounded','collapsed-guardian-floating','aether-assault','aether-wanderer','dimension-wanderer','dimension-splitter','dimension-commander','dimension-devourer','nihil-executor','nihility-executor','chaos-follower','chaos-incarnation'}
before={p.name:p.read_bytes() for p in source.glob('*.png')}
assert set(before)=={name+'.png' for name in names}
with tempfile.TemporaryDirectory(prefix='aetheria-remaining-dimension-sixteen-') as directory:
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

test('remaining dimension sixteen rejects source drift and existing outputs before writes', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v27/dimensional-form/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-remaining-dimension-sixteen-reject-') as directory:
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

test('remaining dimension sixteen rejects opaque or empty candidates without output', () => {
    python(`
import hashlib, runpy, shutil, tempfile
from pathlib import Path
from PIL import Image
module=runpy.run_path('${script}'); prepare=module['prepare']
source=Path('scripts/art_sources/monsters/v27/dimensional-form/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-remaining-dimension-sixteen-alpha-') as directory:
    base=Path(directory)
    for mode, color, message in [('RGB',(1,2,3),'transparency'),('RGBA',(0,0,0,0),'Empty silhouette')]:
        candidate=base/mode; shutil.copytree(source,candidate)
        path=candidate/'space-breaker.png'; Image.new(mode,(16,16),color).save(path)
        original=module['PINS']['space-breaker']
        module['PINS']['space-breaker']=hashlib.sha256(path.read_bytes()).hexdigest()
        output=base/(mode+'-output')
        try: prepare(output,candidate); raise AssertionError('invalid alpha accepted')
        except ValueError as error: assert message in str(error)
        finally: module['PINS']['space-breaker']=original
        assert not output.exists()
`);
});
