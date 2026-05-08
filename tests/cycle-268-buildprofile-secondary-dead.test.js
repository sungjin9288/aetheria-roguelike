import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 268: getRunBuildProfile의 secondary 필드 dead config 제거
 *   (cycle 222-267 silent dead config 시리즈 39번째 — cleanup lens 연속).
 *
 * 발견 (cycle 267 패턴 동일 — dead 필드):
 * - src/utils/runProfile.ts getRunBuildProfile 반환 객체 (line 171-175):
 *   { primary, secondary: ranked.slice(1, 3), tags: ranked.slice(0, 5) }.
 * - 그러나 src/ 어디에도 `.secondary` 접근 0건 — 검색 결과 정의 1건뿐.
 * - tags(buildProfile.tags) / primary(buildProfile.primary)는 dispatched.
 * - secondary만 dead — ranked.slice(1, 3) 계산 결과 쓰여지지 않음.
 *
 * 패턴 (cycle 222-267 silent dead config 시리즈 39번째):
 * - cycle 267: skillLabel 제거.
 * - cycle 268: buildProfile.secondary 제거 (cleanup lens 연속).
 *
 * 수정 (src/utils/runProfile.ts):
 * - getRunBuildProfile 반환 객체에서 secondary 제거.
 *
 * 회귀 가드:
 * - primary / tags 필드 동작 유지.
 * - getRunBuildProfile 시그니처 변화 없음.
 * - 다른 buildProfile consumer (gameUtils / useGameEngine 등) 동작 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 268: getRunBuildProfile의 secondary 필드 정의 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    // 필드 정의 라인 (`secondary:` colon)만 검색.
    assert.ok(!/^\s*secondary:\s*ranked/m.test(source),
        'secondary 필드 정의 제거됨 (dead config cleanup)');
});

test('cycle 268: getRunBuildProfile primary / tags 필드 유지 (회귀 가드)', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.js');
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: [],
        stats: { kills: 10 },
    };
    const profile = getRunBuildProfile(player, { maxHp: 1000 });
    assert.ok(profile.primary, 'primary 필드 유지');
    assert.ok(Array.isArray(profile.tags), 'tags 배열 유지');
    assert.equal(profile.secondary, undefined, 'secondary 필드 제거됨');
});

test('cycle 268: buildProfile.tags 컴포넌트 dispatch 유지 (회귀 가드)', async () => {
    // cycle 344: gameUtils.ts buildTags 출력 dead 정리 후 useGameEngine.ts만 유지.
    //   AI snapshot (playerSnapshot.buildProfile)이 유일한 active dispatch.
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(/buildProfile\.tags/.test(source),
        'useGameEngine buildProfile.tags AI snapshot dispatch 유지');
});

test('cycle 267 회귀 가드: skillLabel 0건 유지', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/^\s*skillLabel:/m.test(source),
        'cycle 267 skillLabel 제거 유지');
});
