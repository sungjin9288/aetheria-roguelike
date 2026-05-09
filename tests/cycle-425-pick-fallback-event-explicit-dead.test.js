import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 425: pickFallbackEvent `explicit` 분기 unreachable 정리
 *   (cycle 222-424 silent dead config 시리즈 185번째 — unreachable code path lens
 *   회귀, cycle 357-359/361-363 패턴, cycle 357 paired completion).
 *
 * 발견 (1 dead lookup + 2 dead conditional branches):
 * - src/utils/aiEventUtils.ts pickFallbackEvent (line 509+):
 *     `const explicit = FALLBACK_EVENT_POOL[loc];`
 *     `const poolKey = explicit ? loc : getPoolKeyByLocation(loc);`
 *     `const basePool = explicit || FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;`
 * - 분석:
 *     · loc 파라미터는 player.loc (항상 Korean: '고요한 숲'/'시작의 마을'/etc.).
 *     · FALLBACK_EVENT_POOL 키는 cycle 357 이후 모두 English category (forest/
 *       ruins/cave/desert/ice/dark/abyss/treasure/machina/sky/deepsea/gate +
 *       structured + default). Korean key 0건.
 *     · 따라서 `FALLBACK_EVENT_POOL[loc]` lookup은 항상 undefined.
 *   → `explicit` 항상 falsy → `explicit ? loc` 분기 / `explicit ||` short-circuit
 *      양쪽 모두 unreachable.
 *
 * 패턴 (cycle 222-424 시리즈 185번째):
 * - cycle 357: 시작의 마을 12 events 제거 (English-only pool 정착).
 * - cycle 425: 그 결과로 `explicit` lookup 잔존 dead branch 정리 — paired completion.
 *
 * 수정 (src/utils/aiEventUtils.ts):
 * - `const explicit = ...` 라인 제거.
 * - `const poolKey = getPoolKeyByLocation(loc);` (단순화).
 * - `const basePool = FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;`.
 *
 * 회귀 가드:
 * - pickFallbackEvent 동작 그대로 — 모든 Korean loc은 getPoolKeyByLocation을 거쳐
 *   English category로 매핑됨 (이미 항상 그 path였음).
 * - `FALLBACK_EVENT_POOL.default` fallback / `structured` 30% mix / dedup 등 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 425: pickFallbackEvent에서 `FALLBACK_EVENT_POOL[loc]` 직접 lookup 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const pickFallbackEvent');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/FALLBACK_EVENT_POOL\[loc\]/.test(block),
        'pickFallbackEvent 본체 FALLBACK_EVENT_POOL[loc] 0건');
});

test('cycle 425: `explicit` 변수 잔존 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const pickFallbackEvent');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bexplicit\b/.test(block),
        'pickFallbackEvent 본체 `explicit` 변수 0건');
});

test('cycle 425: poolKey / basePool 활성 path 보존', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const pickFallbackEvent');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/getPoolKeyByLocation\(loc\)/.test(block), 'getPoolKeyByLocation(loc) 보존');
    assert.ok(/FALLBACK_EVENT_POOL\.default/.test(block), 'FALLBACK_EVENT_POOL.default fallback 보존');
    assert.ok(/FALLBACK_EVENT_POOL\.structured/.test(block), 'structured 30% mix 보존');
});

test('cycle 425: pickFallbackEvent runtime — Korean loc 입력에도 정상 산출', async () => {
    const { pickFallbackEvent } = await import('../src/utils/aiEventUtils.ts');
    // Korean 로케이션은 getPoolKeyByLocation을 거쳐 English category로 매핑.
    const event1 = pickFallbackEvent('고요한 숲', [], {});
    assert.ok(event1, '숲 → forest 매핑 후 fallback event 산출');
    assert.ok(typeof event1.desc === 'string', 'desc 필드 존재');
    assert.ok(Array.isArray(event1.choices), 'choices 배열');

    const event2 = pickFallbackEvent('알 수 없는 지역', [], {});
    assert.ok(event2, "매칭 안 되는 loc → 'default' pool fallback");
    assert.ok(typeof event2.desc === 'string', 'default pool desc 존재');
});

test('cycle 424 회귀 가드: EXACT_ICON_CATEGORY_BY_TYPE undefined 0건', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+undefined:/m.test(block), 'cycle 424 undefined 엔트리 0건 보존');
});
