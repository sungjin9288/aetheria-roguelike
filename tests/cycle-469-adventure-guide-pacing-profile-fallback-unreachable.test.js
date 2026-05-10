import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 469: adventureGuide `odds.pacingProfile || getMapPacingProfile(mapData)`
 *   fallback unreachable + 미사용 import 정리
 *   (cycle 222-468 silent dead config 시리즈 223번째 — defensive fallback redundancy
 *   cleanup lens, cycle 373-388/424 패턴 회귀).
 *
 * 발견 (1 fallback unreachable + 1 미사용 import):
 * - src/utils/adventureGuide.ts (line 96):
 *     const pacingProfile = odds.pacingProfile || getMapPacingProfile(mapData);
 * - producer 분석 (src/utils/explorationPacing.ts):
 *     getDiscoveryOdds 반환에서 pacingProfile은 getMapPacingProfile(mapData)
 *     결과를 set. getMapPacingProfile은 항상 5 profile 중 하나를 객체 리터럴로
 *     반환 (safe/boss/volatile/hostile/frontier) — 절대 null/undefined 반환 0건.
 * - 결과: odds.pacingProfile은 항상 truthy → `||` fallback 진입 0건.
 *   `getMapPacingProfile(mapData)` 두 번째 호출 자체가 unreachable.
 * - import: line 4의 getMapPacingProfile import는 line 96에서만 사용 → fallback
 *   제거 시 import도 정리 대상.
 *
 * 패턴 (cycle 222-468 시리즈 223번째):
 * - cycle 373-388/424: defensive fallback redundancy — producer가 항상 valid 값
 *   반환하는데 consumer가 `|| fallback` 추가한 패턴.
 * - cycle 469: adventureGuide pacingProfile fallback — 동일 lens.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - line 96: `odds.pacingProfile || getMapPacingProfile(mapData)` → `odds.pacingProfile`.
 * - line 4: import에서 getMapPacingProfile 제거.
 *
 * 회귀 가드:
 * - getDiscoveryOdds import 보존.
 * - pacingProfile read (line 109/111/118) 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 469: pacingProfile fallback || getMapPacingProfile 0건', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/odds\.pacingProfile\s*\|\|\s*getMapPacingProfile/.test(source),
        'odds.pacingProfile || getMapPacingProfile fallback 제거');
});

test('cycle 469: getMapPacingProfile import 제거', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMapPacingProfile/.test(source), 'getMapPacingProfile 참조 0건');
});

test('cycle 469: 정합성 가드 — producer는 항상 valid profile 반환', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    // getMapPacingProfile은 5 객체 리터럴 반환 (return null 0건)
    assert.ok(!/return\s+null/.test(source), 'getMapPacingProfile에 return null 0건');
    // pacingProfile 필드 set 보존
    assert.ok(/pacingProfile:\s*profile/.test(source), 'pacingProfile: profile set 보존');
});

test('cycle 469: getDiscoveryOdds import / pacingProfile read 보존', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/getDiscoveryOdds/.test(source), 'getDiscoveryOdds import 보존');
    assert.ok(/pacingProfile\.id/.test(source), 'pacingProfile.id read 보존');
    assert.ok(/pacingProfile\.label/.test(source), 'pacingProfile.label read 보존');
});
