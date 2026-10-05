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
    // Wave 51(소유자 결정 "성직자의 컨셉"): 몬스터 계열 태그(family, 언데드 22 · 마족 7)를 더한 의도된 게임 데이터 변경 — 재고정.
    // Wave 59(소유자 결정 "보스 기믹 전부 설명대로"): 보스 기믹 선언(mechanics) · 페이즈 상태 · 2페이즈 패턴을 고친 의도된 게임 데이터 변경 — 재고정.
    // Wave 60(소유자 결정 "보스별 고정 생명 상향"): 브리핑 보스 22종 hpMult를 1:1 대결로 보정한 의도된 게임 데이터 변경 — 재고정.
    assert.equal(hashMonsters(), 'fb70034911ffd1fa30908d7ee253e35f127bab634487bd772b3406ebed872dce', 'src/data/monsters.ts gameplay data');
    // Wave 61(소유자 결정 "지역 조우에 넣음"): 보스 6종을 지역 조우 풀에 넣고 심연 층 보스 목록을 채우고 지역 설명 잔재를 고친 의도된 게임 데이터 변경 — 재고정.
    // Wave 62(소유자 결정 "전부 설명대로"): 북부 요새 판매 등급 3 · 황금 왕국 물가 ×1.3을 지역 데이터로 선언하고 두 상점 · 허공의 섬 문구를 고친 의도된 게임 데이터 변경 — 재고정.
    assert.equal(hashMaps(), '9b83a7e3a9d14df03a730a1888ed489a9daa9ece43c4f4d49eb43ffe5f4e7a0f', 'src/data/maps.ts gameplay data');
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
