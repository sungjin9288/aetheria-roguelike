import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildMonsterArtCatalog } from '../scripts/monsterArtCatalog.mjs';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';
import { hashMonsters, hashMaps } from './helpers/dataHash.ts';

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
    // W10-B5: monsters.ts/maps.ts 핀은 "게임플레이 데이터 값" 해시다(파일 바이트 해시가
    //   아니다) — tests/helpers/dataHash.ts의 hashGameplayData가 MONSTERS/BOSS_MONSTERS/
    //   MAPS를 정규화(키 재귀 정렬, undefined 드롭, 배열 순서 유지)해서 해시하므로, 값이
    //   그대로면 타입 어노테이션·주석·공백 편집으로는 재고정이 필요 없다. Wave 9 A1의
    //   BOSS_BRIEFS `Record<string, any>` → 리터럴 도출 타입 전환(데이터 값 변경 0건)이
    //   바로 그런 편집이었는데, 이전엔 파일 바이트가 바뀌어 이 핀을 재고정해야 했다.
    //   fire-lizard.png는 아트 산출물이므로 그대로 파일 바이트 해시로 남긴다.
    // Wave 51(소유자 결정 "성직자의 컨셉"): 몬스터 계열 태그(family, 언데드 22 · 마족 7)를 더한 의도된 게임 데이터 변경 — 재고정.
    // Wave 59(소유자 결정 "보스 기믹 전부 설명대로"): 보스 기믹 선언(mechanics) · 페이즈 상태 · 2페이즈 패턴을 고친 의도된 게임 데이터 변경 — 재고정.
    // Wave 60(소유자 결정 "보스별 고정 생명 상향"): 브리핑 보스 22종 hpMult를 1:1 대결로 보정한 의도된 게임 데이터 변경 — 재고정.
    assert.equal(hashMonsters(), 'fb70034911ffd1fa30908d7ee253e35f127bab634487bd772b3406ebed872dce', 'src/data/monsters.ts gameplay data');
    // Wave 61(소유자 결정 "지역 조우에 넣음"): 보스 6종을 지역 조우 풀에 넣고 심연 층 보스 목록을 채우고 지역 설명 잔재를 고친 의도된 게임 데이터 변경 — 재고정.
    // Wave 62(소유자 결정 "전부 설명대로"): 북부 요새 판매 등급 3 · 황금 왕국 물가 ×1.3을 지역 데이터로 선언하고 두 상점 · 허공의 섬 문구를 고친 의도된 게임 데이터 변경 — 재고정.
    assert.equal(hashMaps(), '9b83a7e3a9d14df03a730a1888ed489a9daa9ece43c4f4d49eb43ffe5f4e7a0f', 'src/data/maps.ts gameplay data');
    assert.equal(sha(await read('public/assets/monsters/fire/fire-lizard.png')), '7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1', 'public/assets/monsters/fire/fire-lizard.png');
});
