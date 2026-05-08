import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events dead 정리
 *   (cycle 222-356 silent dead config 시리즈 124번째 — cleanup lens 연속).
 *
 * 발견 (12 dead events — 1 unreachable map key):
 * - aiEventUtils.ts FALLBACK_EVENT_POOL의 '시작의 마을' 키가 12개 fallback events 보유.
 * - exploreActions.ts:23 — `if (player.loc === CONSTANTS.START_LOCATION) return` 가드로
 *   START_LOCATION (= '시작의 마을') 탐험 자체가 블록됨. 따라서 pickFallbackEvent가
 *   loc='시작의 마을'로 호출되는 경로 0건. AI_SERVICE.generateEvent도 동일 진입점이라
 *   완전히 unreachable.
 * - 마을은 type='safe', eventChance=0이라 explore 진입 자체가 게임 디자인상 차단됨.
 *
 * 패턴 (cycle 222-356 silent dead config 시리즈 124번째):
 * - cycle 356: OPERATION_META summary 5회 dead.
 * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events dead.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - FALLBACK_EVENT_POOL에서 '시작의 마을' 키 + 12 entries 일괄 제거.
 *
 * 회귀 가드:
 * - forest / ruins / cave / desert / ice / dark / abyss / treasure / machina /
 *   sky / deepsea / gate / default / structured 14 키 보존.
 * - pickFallbackEvent / getPoolKeyByLocation 동작 그대로.
 * - explore 가드 (player.loc === START_LOCATION return) 회귀 가드.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 357: FALLBACK_EVENT_POOL에서 \'시작의 마을\' 키 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
    const fnEnd = source.indexOf('export const pickFallbackEvent');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/'시작의 마을':/.test(block),
        'FALLBACK_EVENT_POOL에서 \'시작의 마을\' 키 0건');
});

test('cycle 357: FALLBACK_EVENT_POOL 활성 키 14종 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
    const fnEnd = source.indexOf('export const pickFallbackEvent');
    const block = source.slice(fnStart, fnEnd);
    const expected = ['forest', 'ruins', 'cave', 'desert', 'ice', 'dark', 'abyss',
                      'treasure', 'machina', 'sky', 'deepsea', 'gate', 'default', 'structured'];
    for (const key of expected) {
        assert.ok(new RegExp(`^    ${key}:`, 'm').test(block), `${key} 키 보존`);
    }
});

test('cycle 357: explore 가드 회귀 보존 (START_LOCATION 차단)', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/player\.loc === CONSTANTS\.START_LOCATION.+return addLog\('info'/.test(source),
        'explore에서 START_LOCATION return 가드 보존');
});

test('cycle 356 회귀 가드: OPERATION_META summary 0건 보존', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
    const block = blockMatch[0];
    const summaryMatches = block.match(/summary:/g) || [];
    assert.equal(summaryMatches.length, 0, 'cycle 356 summary 0건 보존');
});
