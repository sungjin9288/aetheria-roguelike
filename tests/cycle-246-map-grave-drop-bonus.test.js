import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraveData } from '../src/utils/graveUtils.js';

/**
 * cycle 246: MAPS의 graveDropBonus 필드 dead config fix
 *   (cycle 222-245 silent dead config 시리즈 18번째).
 *
 * 발견 (graveDropBonus 미적용):
 * - src/data/maps.ts: '영혼의 강' 지역만 graveDropBonus: 2.0 정의 (lore: "묘비 아이템이 자주
 *   발견됩니다").
 * - 그러나 buildGraveData는 player.gold / 2와 1-2 random items만 dispatch — graveDropBonus
 *   read 0건 → 영원히 보너스 미적용.
 * - 결과: '영혼의 강'의 lore와 데이터 정의가 모순 — 사망 시 다른 지역과 동일한 묘비 보상.
 *
 * 패턴 (cycle 222-245 silent dead config 시리즈 18번째):
 * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds UI dispatch 누락 (data → util → struct → UI).
 * - cycle 246: MAPS graveDropBonus dispatch 누락 (data → util 경로).
 *
 * 수정 (src/utils/graveUtils.ts):
 * - buildGraveData에서 player.loc → MAPS[loc].graveDropBonus 조회 (default 1.0).
 * - gold *= bonus, dropCount = ceil(originalCount * bonus) (cap inv length).
 *
 * 회귀 가드:
 * - graveDropBonus 미정의 지역(99% 케이스)은 기존 동작 유지 (gold/2, 1-2 items).
 * - inv 비어있을 시 items 빈 배열 (no error).
 */

test('cycle 246: 영혼의 강에서 사망 시 graveDropBonus 2.0 → gold 2x', () => {
    const player = {
        name: 'Test', loc: '영혼의 강', gold: 1000,
        inv: [
            { name: 'item1', id: 'a' },
            { name: 'item2', id: 'b' },
            { name: 'item3', id: 'c' },
            { name: 'item4', id: 'd' },
        ],
    };
    // gold default = 1000/2 = 500. bonus 2.0 → 1000.
    const grave = buildGraveData(player, () => 0.5, () => 1000);
    assert.equal(grave.gold, 1000,
        `'영혼의 강' graveDropBonus 2.0 → gold 1000 (실제: ${grave.gold})`);
});

test('cycle 246: 일반 지역 사망 시 기본 동작 유지 (회귀 가드)', () => {
    const player = {
        name: 'Test', loc: '슬라임 숲', gold: 1000,
        inv: [
            { name: 'item1', id: 'a' },
            { name: 'item2', id: 'b' },
        ],
    };
    const grave = buildGraveData(player, () => 0.5, () => 1000);
    assert.equal(grave.gold, 500,
        `일반 지역 → gold/2=500 (회귀 가드, 실제: ${grave.gold})`);
});

test('cycle 246: 영혼의 강 dropCount 2x', () => {
    const player = {
        name: 'Test', loc: '영혼의 강', gold: 100,
        // 4 items so 2x of 2 dropCount = 4 (cap inv length).
        inv: [
            { name: 'item1', id: 'a' },
            { name: 'item2', id: 'b' },
            { name: 'item3', id: 'c' },
            { name: 'item4', id: 'd' },
        ],
    };
    // random < 0.5 → 1 item default. bonus 2.0 → 2 items.
    const grave = buildGraveData(player, () => 0.4, () => 1000);
    assert.equal(grave.items.length, 2,
        `'영혼의 강' graveDropBonus 2.0 → 2 items (default 1 * 2, 실제: ${grave.items.length})`);
});

test('cycle 246: graveDropBonus inv 부족 시 cap', () => {
    const player = {
        name: 'Test', loc: '영혼의 강', gold: 100,
        inv: [{ name: 'item1', id: 'a' }],
    };
    // 1 item × 2.0 = 2이지만 inv 1개라서 1로 cap.
    const grave = buildGraveData(player, () => 0.4, () => 1000);
    assert.equal(grave.items.length, 1,
        `inv 1개 한계 → 1 item cap (실제: ${grave.items.length})`);
});

test('cycle 246: 영혼의 강 graveDropBonus 데이터 보존 (회귀 가드)', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    assert.ok(MAPS['영혼의 강'], "'영혼의 강' 지역 데이터 존재");
    assert.equal(MAPS['영혼의 강'].graveDropBonus, 2.0,
        'graveDropBonus 2.0 데이터 회귀 가드');
});

test('cycle 246: 빈 inv 시 items 빈 배열 (안전 가드)', () => {
    const player = {
        name: 'Test', loc: '영혼의 강', gold: 100,
        inv: [],
    };
    const grave = buildGraveData(player, () => 0.4, () => 1000);
    assert.deepEqual(grave.items, [], 'inv 비어있을 시 items=[]');
    assert.equal(grave.gold, 100, '빈 inv여도 gold bonus는 적용');
});
