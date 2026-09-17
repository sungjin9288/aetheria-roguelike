import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/art_sources/monsters/v20/prepare.py';
function python(body) {
    assert.ok(existsSync(script), 'boss-body preparer must exist');
    const result = spawnSync('python3', ['-c', body], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
}

test('boss-body exports preserve nine masters and generate deterministic bounded sprites', () => {
    python(`
import hashlib, json, runpy, tempfile
from pathlib import Path
from PIL import Image
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v20/masters')
names={'void-judge','rift-commander','annihilation-apostle','abyss-sentinel','resentful-champion','outpost-commander','doom-knight','dimension-splitter','void-herald'}
before={p.name:p.read_bytes() for p in source.glob('*.png')}
assert set(before)=={name+'.png' for name in names}
with tempfile.TemporaryDirectory(prefix='aetheria-boss-body-') as directory:
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
        master=Image.open(source/f'{name}.png')
        original=master.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
        assert abs((original[2]-original[0])/(original[3]-original[1])-(bounds[2]-bounds[0])/(bounds[3]-bounds[1]))<0.025
assert before=={p.name:p.read_bytes() for p in source.glob('*.png')}
`);
});

test('boss-body preparation rejects every drifted master and existing output before writes', () => {
    python(`
import runpy, shutil, tempfile
from pathlib import Path
prepare=runpy.run_path('${script}')['prepare']
source=Path('scripts/art_sources/monsters/v20/masters')
with tempfile.TemporaryDirectory(prefix='aetheria-boss-reject-') as directory:
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
