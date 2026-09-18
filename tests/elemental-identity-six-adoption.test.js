import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';
import { hashMonsters, hashMaps } from './helpers/dataHash.ts';

const base = new URL('../scripts/art_sources/monsters/v25/', import.meta.url);
const root = new URL('../', import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const remainingNames = new Set((await readJson(new URL('scripts/art_sources/monsters/v27/preflight.json', root))).selected.map(({ name }) => name));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portraits = {
    '번개 골렘': 'lightning-golem',
    '부식된 골렘': 'corroded-golem',
    '얼음 기사': 'ice-knight',
    '호수 수호자': 'lake-guardian',
    '화염 와이번': 'fire-wyvern',
    '화염 비룡': 'fire-drake',
};

test('elemental six preserves approved monster and map gameplay data', () => {
    // W10-B5: 이 핀은 src/data/monsters.ts·maps.ts의 "게임플레이 데이터 값" 해시다
    //   (파일 바이트 해시가 아니다) — tests/helpers/dataHash.ts의 hashGameplayData가
    //   MONSTERS/BOSS_MONSTERS/MAPS를 정규화(키 재귀 정렬, undefined 드롭, 배열 순서
    //   유지)해서 해시하므로, 값이 그대로면 타입 어노테이션·주석·공백 편집으로는
    //   재고정이 필요 없다. Wave 9 A1의 BOSS_BRIEFS `Record<string, any>` → 리터럴
    //   도출 타입 전환(데이터 값 변경 0건)이 바로 그런 편집이었는데, 이전엔 파일
    //   바이트가 바뀌어 이 핀을 재고정해야 했다.
    assert.equal(hashMonsters(), 'e1fcef50109f3011d8dab5ad8e18aaa81b62ee0ccb4e3eddcf04a9918566b2d7', 'src/data/monsters.ts gameplay data');
    assert.equal(hashMaps(), '34f3eccb41468ff5e4f6069757bd5a5f6f09b6ca3c7db1463a00757396999cd4', 'src/data/maps.ts gameplay data');
});

test('six elemental portraits resolve to approved v25 bytes through authored registry and runtime', async () => {
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

test('six elemental adoptions change only their pins and preserve the v24-to-v25 checkpoint chain', async () => {
    const before = await readJson(new URL('previous/monsterArtManifest.json', base));
    // v26 preserves this checkpoint; retained-ten tests own the live other244 contract.
    const successor = new URL('../v26/previous/', base);
    const after = await readJson(new URL('monsterArtManifest.json', successor));
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
            const retainedTen = ['전류 추적자', '변이 실험체', '에테르 잔류체', '에테르 흡수체', '망자의 사제', '암흑 사제', '언데드 마법사', '화염 도마뱀', '불꽃 도마뱀', '화산 도마뱀'];
            const bytes = retainedTen.includes(name)
                ? new URL(`${entry.key}.png`, successor)
                : new URL(remainingNames.has(name)
                    ? `scripts/art_sources/monsters/v27/previous/${entry.key}.png`
                    : `public${entry.runtimePath}`, root);
            assert.equal(sha(await readFile(bytes)), entry.sha256, name);
        }
    }
    assert.equal(Object.keys(oldEntries).length - changed.length, 248);
    assert.deepEqual(changed.sort(), Object.keys(portraits).sort());

    assert.equal(Object.keys(beforeRegistry.entries).length, 149);
    assert.equal(Object.keys(afterRegistry.entries).length, 155);
    for (const [name, correction] of Object.entries(beforeRegistry.entries)) {
        assert.deepEqual(afterRegistry.entries[name], correction, name);
    }
    assert.deepEqual(
        Object.keys(afterRegistry.entries).filter((name) => !Object.hasOwn(beforeRegistry.entries, name)).sort(),
        Object.keys(portraits).sort(),
    );
});
