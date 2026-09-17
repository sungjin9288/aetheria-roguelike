import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';

const base = new URL('../scripts/art_sources/monsters/v23/', import.meta.url);
const root = new URL('../', import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portraits = {
    '서리 늑대': 'frost-wolf',
    '잉크 슬라임': 'ink-slime',
    '화염 감시자': 'flame-watcher',
};

test('three regional portraits resolve to approved v23 bytes through authored registry and runtime', async () => {
    const catalog = await buildMonsterArtCatalog();
    const manifest = await readJson(new URL('src/data/monsterArtManifest.json', root));
    const receipt = await readJson(new URL('exports/receipt.json', base));

    for (const [name, slug] of Object.entries(portraits)) {
        const correction = catalog.corrections[name];
        const entry = manifest.entries[name];
        const expected = await readFile(new URL(`exports/${slug}.png`, base));

        assert.ok(correction, `${name} must not keep a generic regional prototype`);
        assert.equal(sha(expected), receipt.exportSha256[slug]);
        assert.equal(correction.sha256, sha(expected), name);
        assert.equal(entry.sourceRuntimePath, correction.sourceRuntimePath, name);
        for (const runtimePath of [entry.runtimePath, correction.sourceRuntimePath]) {
            assert.deepEqual(await readFile(new URL(`public${runtimePath}`, root)), expected, name);
        }
        assert.equal(getMonsterVisual(name).src, entry.runtimePath);
        assert.equal(getMonsterVisual(`정예 ${name}`).src, entry.runtimePath);
    }
});

test('three regional adoptions change only their pins and preserve the v20-to-v23 checkpoint chain', async () => {
    const before = await readJson(new URL('previous/monsterArtManifest.json', base));
    // v24 preserves the completed v23 snapshot; its own tests bind the live successor.
    const successor = new URL('../v24/previous/', base);
    const after = await readJson(new URL('monsterArtManifest.json', successor));
    const live = await readJson(new URL('src/data/monsterArtManifest.json', root));
    const remainingNames = new Set((await readJson(new URL('scripts/art_sources/monsters/v27/preflight.json', root))).selected.map(({ name }) => name));
    const beforeRegistry = await readJson(new URL('previous/corrections.json', base));
    const afterRegistry = await readJson(new URL('corrections.json', successor));
    const { entries: oldEntries, ...oldHeader } = before;
    const { entries: newEntries, ...newHeader } = after;

    assert.deepEqual(newHeader, oldHeader);
    assert.deepEqual(Object.keys(newEntries).sort(), Object.keys(oldEntries).sort());
    const changed = [];
    for (const [name, entry] of Object.entries(oldEntries)) {
        const current = newEntries[name];
        if (Object.hasOwn(portraits, name)) {
            const { sourceRuntimePath: oldSource, sha256: oldHash, ...oldIdentity } = entry;
            const { sourceRuntimePath: newSource, sha256: newHash, ...newIdentity } = current;
            assert.deepEqual(newIdentity, oldIdentity, name);
            assert.notEqual(newSource, oldSource, name);
            assert.notEqual(newHash, oldHash, name);
            assert.equal(sha(await readFile(new URL(`previous/${entry.key}.png`, base))), oldHash, name);
            changed.push(name);
        } else {
            assert.deepEqual(current, entry, name);
            const elementalSix = ['번개 골렘', '부식된 골렘', '얼음 기사', '호수 수호자', '화염 와이번', '화염 비룡'];
            const retainedTen = ['전류 추적자', '변이 실험체', '에테르 잔류체', '에테르 흡수체', '망자의 사제', '암흑 사제', '언데드 마법사', '화염 도마뱀', '불꽃 도마뱀', '화산 도마뱀'];
            const preserved = remainingNames.has(name)
                ? new URL(`scripts/art_sources/monsters/v27/previous/${entry.key}.png`, root)
                : retainedTen.includes(name)
                ? new URL(`scripts/art_sources/monsters/v26/previous/${entry.key}.png`, root)
                : elementalSix.includes(name)
                ? new URL(`scripts/art_sources/monsters/v25/previous/${entry.key}.png`, root)
                : new URL(`${entry.key}.png`, successor);
            const bytes = live.entries[name].sha256 === entry.sha256
                ? await readFile(new URL(`public${entry.runtimePath}`, root))
                : await readFile(preserved);
            assert.equal(sha(bytes), entry.sha256, name);
        }
    }
    assert.equal(Object.keys(oldEntries).length - changed.length, 251);
    assert.deepEqual(changed.sort(), Object.keys(portraits).sort());

    assert.equal(Object.keys(beforeRegistry.entries).length, 140);
    assert.equal(Object.keys(afterRegistry.entries).length, 143);
    for (const [name, correction] of Object.entries(beforeRegistry.entries)) {
        assert.deepEqual(afterRegistry.entries[name], correction, name);
    }
    assert.deepEqual(
        Object.keys(afterRegistry.entries).filter((name) => !Object.hasOwn(beforeRegistry.entries, name)).sort(),
        Object.keys(portraits).sort(),
    );
});
