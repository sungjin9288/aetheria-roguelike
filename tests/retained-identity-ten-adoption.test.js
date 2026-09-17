import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';

const base = new URL('../scripts/art_sources/monsters/v26/', import.meta.url);
const root = new URL('../', import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portraits = {
    "전류 추적자": "current-tracker",
    "변이 실험체": "mutant-specimen",
    "에테르 잔류체": "aether-residue",
    "에테르 흡수체": "aether-absorber",
    "망자의 사제": "dead-priest",
    "암흑 사제": "dark-priest",
    "언데드 마법사": "undead-mage",
    "화염 도마뱀": "fire-lizard",
    "불꽃 도마뱀": "flame-lizard",
    "화산 도마뱀": "volcanic-lizard"
};

test('retained ten preserves approved monster and map gameplay sources', async () => {
    for (const [path, expected] of Object.entries({
        'src/data/monsters.ts': 'e278d7b0fb8a4a256a3e07f7fb7500114a5ae945bc08e4892b21e26459fe0d09',
        'public/assets/monsters/fire/fire-lizard.png': '7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1',
        'src/data/maps.ts': 'bfa8b82d98a15eff56098a641d59f85a0f6a1bb613c6ac9602cae0689f004a72',
    })) assert.equal(sha(await readFile(new URL(path, root))), expected, path);
});

test('ten retained portraits resolve to approved v26 bytes through authored registry and runtime', async () => {
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

test('ten retained adoptions change only their pins and preserve the v25-to-v26 checkpoint chain', async () => {
    const before = await readJson(new URL('previous/monsterArtManifest.json', base));
    const after = await readJson(new URL('scripts/art_sources/monsters/v27/previous/monsterArtManifest.json', root));
    const beforeRegistry = await readJson(new URL('previous/corrections.json', base));
    const afterRegistry = await readJson(new URL('scripts/art_sources/monsters/v27/previous/corrections.json', root));
    const laterNames = new Set((await readJson(new URL('scripts/art_sources/monsters/v27/preflight.json', root))).selected.map(({ name }) => name));
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
            const preservedPath = laterNames.has(name)
                ? `scripts/art_sources/monsters/v27/previous/${entry.key}.png`
                : `public${entry.runtimePath}`;
            assert.equal(sha(await readFile(new URL(preservedPath, root))), entry.sha256, name);
        }
    }
    assert.equal(Object.keys(oldEntries).length - changed.length, 244);
    assert.deepEqual(changed.sort(), Object.keys(portraits).sort());

    assert.equal(Object.keys(beforeRegistry.entries).length, 155);
    assert.equal(Object.keys(afterRegistry.entries).length, 165);
    for (const [name, correction] of Object.entries(beforeRegistry.entries)) {
        assert.deepEqual(afterRegistry.entries[name], correction, name);
    }
    assert.deepEqual(
        Object.keys(afterRegistry.entries).filter((name) => !Object.hasOwn(beforeRegistry.entries, name)).sort(),
        Object.keys(portraits).sort(),
    );
});
