import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('all eight corrected character masters and runtime portraits are adopted together', () => {
    for (const key of ['ranger', 'hunt-lord', 'mage', 'archmage', 'grand-mage', 'cleric', 'paladin', 'shaman']) {
        for (const [candidate, current] of [
            ['sources', 'scripts/art_sources/characters'],
            ['runtime', 'public/assets/avatars/canonical'],
        ]) {
            const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
            assert.equal(
                digest(`${current}/${key}.png`),
                digest(`scripts/art_sources/character_alpha_v1/prepared-eight/${candidate}/${key}.png`),
                `${key} ${candidate} must use the reviewed correction`,
            );
        }
    }
});

test('reviewed bow apertures become transparent without altering strings, costume or ambiguous quiver whites', () => {
    const result = spawnSync('python3', ['-c', `
import importlib.util
from pathlib import Path
from PIL import Image
spec = importlib.util.spec_from_file_location('apertures', 'scripts/art_sources/character_alpha_v1/prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for key, expected in [('ranger', 51945), ('hunt-lord', 42852)]:
    path = Path('scripts/art_sources/character_alpha_v1/originals') / (key + '.png')
    before = path.read_bytes()
    original = Image.open(path).convert('RGBA')
    corrected = module.correct_apertures(original, module.SELECTION[key]['seeds'])
    changed = 0
    for old, new in zip(original.getdata(), corrected.getdata()):
        if old != new:
            changed += 1
            assert old[:3] == new[:3] and old[3] == 255 and new[3] == 0
            assert min(old[:3]) >= 225 and max(old[:3]) - min(old[:3]) <= 12
    assert changed == expected, (key, changed)
    for seed in module.SELECTION[key]['seeds']:
        assert corrected.getpixel(seed)[3] == 0
    for point in ([(400,566), (369,574), (604,323), (811,320)] if key == 'ranger' else [(514,458), (875,300)]):
        assert original.getpixel(point)[3] == 255
        assert corrected.getpixel(point) == original.getpixel(point)
    assert path.read_bytes() == before and original.tobytes() == Image.open(path).convert('RGBA').tobytes()
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('character aperture preparation is deterministic, refuses source drift and never overwrites prior output', () => {
    const result = spawnSync('python3', ['-c', `
import importlib.util
import tempfile
from pathlib import Path
from PIL import Image
spec = importlib.util.spec_from_file_location('apertures', 'scripts/art_sources/character_alpha_v1/prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='aetheria-bow-') as directory:
    root = Path(directory)
    first = module.prepare(root / 'first')
    assert first == module.prepare(root / 'second')
    for key in module.SELECTION:
        for folder in ('sources', 'runtime'):
            relative = Path(folder) / (key + '.png')
            assert (root/'first'/relative).read_bytes() == (root/'second'/relative).read_bytes()
        runtime = Image.open(root/'first'/'runtime'/(key+'.png'))
        assert runtime.size == (768,768)
        assert runtime.getchannel('A').getbbox()[3] == 709
    before = {p.relative_to(root/'first'):p.read_bytes() for p in (root/'first').rglob('*') if p.is_file()}
    try:
        module.prepare(root/'first')
        raise AssertionError('existing output accepted')
    except FileExistsError:
        pass
    assert all((root/'first'/p).read_bytes() == data for p,data in before.items())
    fake = root/'drift'
    fake.mkdir()
    for key in module.SELECTION:
        Image.new('RGBA',(1254,1254)).save(fake/(key+'.png'))
    try:
        module.prepare(root/'rejected', source_dir=fake)
        raise AssertionError('unreviewed source accepted')
    except ValueError as error:
        assert 'hash drift' in str(error)
    assert not (root/'rejected').exists()
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('staff and halo apertures preserve crystal light, holy symbols, white robes and spirit faces', () => {
    const result = spawnSync('python3', ['-c', `
import importlib.util
from pathlib import Path
from PIL import Image
spec = importlib.util.spec_from_file_location('apertures', 'scripts/art_sources/character_alpha_v1/prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
cases = {
 'mage': ([(316,442),(438,810),(477,953)], [(287,232),(770,660)]),
 'archmage': ([(273,247),(290,499),(995,493),(1018,492)], [(314,274),(580,796)]),
 'grand-mage': ([(838,313),(240,230),(370,270),(965,563)], [(300,262),(881,257),(580,823)]),
 'cleric': ([(830,398),(914,420),(944,512),(271,300)], [(896,452),(876,328),(871,582),(1008,443),(693,499)]),
 'paladin': ([(802,300),(946,294),(939,238)], [(881,297),(869,558),(868,183),(975,298)]),
 'shaman': ([(256,320),(315,550),(422,811)], [(959,458),(300,846),(181,438)]),
}
for key,(holes,highlights) in cases.items():
 path=Path('scripts/art_sources/character_alpha_v1/originals')/(key+'.png')
 before=path.read_bytes()
 source=Image.open(path).convert('RGBA')
 assert key in module.SELECTION, key+' lacks reviewed aperture correction'
 result=module.correct_apertures(source,module.SELECTION[key]['seeds'])
 for point in holes:
  assert source.getpixel(point)[3]==255
  assert result.getpixel(point)[3]==0, (key,point)
 for point in highlights:
  assert source.getpixel(point)[3]==255
  assert result.getpixel(point)==source.getpixel(point), (key,point,'artwork erased')
 assert path.read_bytes()==before
`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
