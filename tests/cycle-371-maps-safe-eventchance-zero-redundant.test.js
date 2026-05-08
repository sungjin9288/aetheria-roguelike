import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 371: maps.ts safe-zone eventChance: 0 5회 redundant 정리
 *   (cycle 222-370 silent dead config 시리즈 136번째 — cleanup lens 연속).
 *
 * 발견 (5 redundant default annotations):
 * - src/data/maps.ts에 5 safe-zone 맵 (시작의 마을 / 여행자의 쉼터 /
 *   사막 오아시스 / 북부 요새 / 허공의 섬)이 `eventChance: 0` 명시.
 * - 모든 eventChance 사용 사이트가 `mapData.eventChance || 0` fallback —
 *   undefined와 0 둘 다 0으로 처리.
 * - explorationPacing.ts:28의 `mapData.type === 'safe'` 가드가 더 빠르게 트리거,
 *   safe map은 narrative event 발동 자체가 차단.
 * - eventChance: 0 is undefined와 동일 효과 → redundant.
 *
 * 핵심 비교:
 * - 황금 무역 도시 (type: 'safe', eventChance: 0.28) — 0과 다른 명시 값 → 보존.
 *
 * 패턴 (cycle 222-370 silent dead config 시리즈 136번째):
 * - cycle 367: maps boss: false 4 redundant.
 * - cycle 371: maps safe-zone eventChance: 0 5 redundant.
 *
 * 수정 (src/data/maps.ts):
 * - 5 safe-zone 맵에서 `eventChance: 0` 라인 제거.
 *
 * 회귀 가드:
 * - 황금 무역 도시 (type: 'safe', eventChance: 0.28) 보존 — 다른 값.
 * - 6 safe-zone 맵 (type: 'safe') 정의 자체는 모두 보존.
 * - getNarrativeEventChance / getMapPacingProfile 동작 그대로 (`|| 0` fallback +
 *   type==='safe' early return).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 371: maps.ts safe-zone eventChance: 0 0건', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/eventChance: 0$/gm) || [];
    assert.equal(matches.length, 0,
        `safe-zone eventChance: 0 (라인 끝) 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 371: 6 safe-zone 맵 정의 보존 (type: \'safe\')', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/type: 'safe'/g) || [];
    assert.ok(matches.length >= 6, `6+ safe-zone 보존 (${matches.length}건)`);
});

test('cycle 371: 황금 왕국 eventChance 0.28 보존 (safe + 다른 값)', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    assert.equal(MAPS['황금 왕국'].type, 'safe', '황금 왕국 type=safe');
    assert.equal(MAPS['황금 왕국'].eventChance, 0.28,
        '황금 왕국 eventChance 0.28 보존 (default 0과 다른 명시 값)');
});

test('cycle 371: MAPS 동작 보존', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    const safeMaps = ['시작의 마을', '여행자의 쉼터', '사막 오아시스', '북부 요새', '허공의 섬'];
    for (const name of safeMaps) {
        assert.equal(MAPS[name].type, 'safe', `${name} type 'safe' 보존`);
        assert.equal(MAPS[name].eventChance, undefined, `${name} eventChance 0건 (undefined fallback)`);
    }
});

test('cycle 367 회귀 가드: maps boss: false 0건 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/boss: false/g) || [];
    assert.equal(matches.length, 0, 'cycle 367 boss: false 0건 보존');
});
