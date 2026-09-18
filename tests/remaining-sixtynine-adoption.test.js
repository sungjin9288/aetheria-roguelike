import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';

const root = new URL('../', import.meta.url);
const base = 'scripts/art_sources/monsters/v27/';
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const groups = [
    ['stone-material', 'exports'], ['occupation', 'exports-reviewed'],
    ['guard-duty', 'exports'], ['knight-form', 'exports-reviewed'],
    ['caster-role', 'exports-reviewed'], ['dimensional-form', 'exports-reviewed'],
    ['named-presence', 'exports-reviewed'],
];

test('remaining69 runtime resolves exact reviewed candidates and preserves original masters', async () => {
    const preflight = await json(`${base}preflight.json`);
    const manifest = await json('src/data/monsterArtManifest.json');
    const catalog = await buildMonsterArtCatalog();
    const selected = [];
    for (const [group, output] of groups) {
        const folder = `${base}${group}/`;
        const records = await json(`${folder}generation-records.json`);
        const receipt = await json(`${folder}${output}/receipt.json`);
        for (const { name, slug } of records.records) {
            selected.push(name);
            assert.equal(sha(await read(`${folder}masters/${slug}.png`)), receipt.sourceSha256[slug]);
            const bytes = await read(`${folder}${output}/${slug}.png`);
            assert.equal(sha(bytes), receipt.exportSha256[slug]);
            const entry = manifest.entries[name];
            const correction = catalog.corrections[name];
            assert.ok(correction, `${name} must use reviewed authored art`);
            assert.equal(correction.sha256, sha(bytes), name);
            assert.equal(entry.sourceRuntimePath, correction.sourceRuntimePath, name);
            assert.equal(entry.sha256, sha(bytes), name);
            for (const path of [entry.runtimePath, correction.sourceRuntimePath]) {
                assert.deepEqual(await read(`public${path}`), bytes, name);
            }
            for (const prefix of ['', '정예 ', '광폭한 ']) {
                assert.equal(getMonsterVisual(`${prefix}${name}`).src, entry.runtimePath, name);
            }
        }
    }
    assert.equal(selected.length, 69);
    assert.equal(new Set(selected).size, 69);
    assert.deepEqual(selected.sort(), preflight.selected.map(({ name }) => name).sort());
});

test('remaining69 adoption preserves other185 identities, bytes and existing165 corrections', async () => {
    const before = await json(`${base}previous/monsterArtManifest.json`);
    const after = await json('src/data/monsterArtManifest.json');
    const preflight = await json(`${base}preflight.json`);
    const selected = new Set(preflight.selected.map(({ name }) => name));
    const { entries: oldEntries, ...oldHeader } = before;
    const { entries: newEntries, ...newHeader } = after;
    assert.deepEqual(newHeader, oldHeader);
    assert.deepEqual(Object.keys(newEntries), Object.keys(oldEntries));
    let preserved = 0;
    for (const [name, entry] of Object.entries(oldEntries)) {
        if (selected.has(name)) {
            const { sourceRuntimePath: oldSource, sha256: oldHash, ...oldIdentity } = entry;
            const { sourceRuntimePath: newSource, sha256: newHash, ...newIdentity } = newEntries[name];
            assert.deepEqual(newIdentity, oldIdentity, name);
            assert.notEqual(newSource, oldSource, name);
            assert.notEqual(newHash, oldHash, name);
            assert.equal(sha(await read(`${base}previous/${entry.key}.png`)), oldHash, name);
        } else {
            preserved++;
            assert.deepEqual(newEntries[name], entry, name);
            assert.equal(sha(await read(`public${entry.runtimePath}`)), entry.sha256, name);
        }
    }
    assert.equal(preserved, 185);
    const oldRegistry = await json(`${base}previous/corrections.json`);
    const registry = await json('scripts/art_sources/monsters/v1/corrections.json');
    assert.equal(Object.keys(oldRegistry.entries).length, 165);
    assert.equal(Object.keys(registry.entries).length, 234);
    for (const [name, value] of Object.entries(oldRegistry.entries)) assert.deepEqual(registry.entries[name], value);
    assert.deepEqual(Object.keys(registry.entries).filter((name) => !Object.hasOwn(oldRegistry.entries, name)).sort(), [...selected].sort());
});

test('remaining69 preserves numeric sources, prototype and historical release evidence', async () => {
    const preflight = await json(`${base}preflight.json`);
    for (const records of Object.values(preflight.protectedRecords)) {
        for (const [path, hash] of records) assert.equal(sha(await read(path)), hash, path);
    }
    for (const [path, hash] of Object.entries({
        // W9-A1: 이 핀은 src/data/monsters.ts 파일 바이트 해시다. Wave 9 A1이 BOSS_BRIEFS의
        //   `Record<string, any>` 선언을 리터럴 도출 타입으로 바꾸면서(데이터 값 변경 0건,
        //   tests/data-shape-types.test.js 그린) 파일 해시가 바뀌어 핀을 재고정했다.
        'src/data/monsters.ts': '930dc880a98672bc8cf7492dfa9c2533cb84fb0dc5c5859b9af6b403f28be70c',
        'src/data/maps.ts': 'bfa8b82d98a15eff56098a641d59f85a0f6a1bb613c6ac9602cae0689f004a72',
        'public/assets/monsters/fire/fire-lizard.png': '7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1',
    })) assert.equal(sha(await read(path)), hash, path);
});
