import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';
import { hashMonsters, hashMaps } from './helpers/dataHash.ts';

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

test('retained ten preserves approved monster and map gameplay data', async () => {
    // W10-B5: monsters.ts/maps.ts 핀은 "게임플레이 데이터 값" 해시다(파일 바이트 해시가
    //   아니다) — tests/helpers/dataHash.ts의 hashGameplayData가 MONSTERS/BOSS_MONSTERS/
    //   MAPS를 정규화(키 재귀 정렬, undefined 드롭, 배열 순서 유지)해서 해시하므로, 값이
    //   그대로면 타입 어노테이션·주석·공백 편집으로는 재고정이 필요 없다. Wave 9 A1의
    //   BOSS_BRIEFS `Record<string, any>` → 리터럴 도출 타입 전환(데이터 값 변경 0건)이
    //   바로 그런 편집이었는데, 이전엔 파일 바이트가 바뀌어 이 핀을 재고정해야 했다.
    //   fire-lizard.png는 아트 산출물이므로 그대로 파일 바이트 해시로 남긴다.
    assert.equal(hashMonsters(), 'e1fcef50109f3011d8dab5ad8e18aaa81b62ee0ccb4e3eddcf04a9918566b2d7', 'src/data/monsters.ts gameplay data');
    assert.equal(hashMaps(), '34f3eccb41468ff5e4f6069757bd5a5f6f09b6ca3c7db1463a00757396999cd4', 'src/data/maps.ts gameplay data');
    assert.equal(
        sha(await readFile(new URL('public/assets/monsters/fire/fire-lizard.png', root))),
        '7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1',
        'public/assets/monsters/fire/fire-lizard.png',
    );
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
