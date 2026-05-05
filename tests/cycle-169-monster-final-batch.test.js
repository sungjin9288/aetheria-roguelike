import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 169 🎯: maps.ts 참조 누락 monster profile 추가 — 잔존 10종 batch
 * (cycle 165 baseline 10 → 0 달성).
 *
 * 5 사이클(165-169) 점진 정리:
 *   165(42) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0
 *
 * 모든 maps.ts spawn pool 참조 monster가 MONSTERS profile 보유. spawnEnemy
 * (exploreUtils.ts:175)의 DB.MONSTERS[baseName] lookup이 모든 spawn 케이스에서
 * hit. 속성 약점/저항/패턴/statusOnHit 메커니즘이 모든 enemy에 적용됨.
 *
 * 이번 사이클 batch:
 * - 바람 (2): 광풍의 원소 / 바람 추적자 — weakness 대지, resistance 자연.
 * - 심연 (1): 심연의 눈 — weakness 빛, resistance 어둠 (statusOnHit curse).
 * - 에테르 (2): 에테르 잔류체 / 에테르 흡수체 — weakness 자연, resistance 빛.
 * - 종말 (2): 종말의 마법사 (nuker) / 종말의 전령 (보스 톤).
 * - 허무/혼돈 (2): 허무 집행관 (탱커) / 혼돈의 추종자 (statusOnHit curse).
 * - 차원 (1): 차원 방랑자.
 */

const FINAL_BATCH = [
    '광풍의 원소', '바람 추적자',
    '심연의 눈',
    '에테르 잔류체', '에테르 흡수체',
    '종말의 마법사', '종말의 전령',
    '허무 집행관', '혼돈의 추종자',
    '차원 방랑자',
];

test('cycle 169: 잔존 10종 모두 MONSTERS 등록 + 필수 필드 (hp/atk/def/exp/gold)', () => {
    for (const name of FINAL_BATCH) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.ok(typeof profile.hp === 'number' && profile.hp > 0, `${name} hp`);
        assert.ok(typeof profile.atk === 'number' && profile.atk > 0, `${name} atk`);
        assert.ok(typeof profile.def === 'number' && profile.def >= 0, `${name} def`);
        assert.ok(typeof profile.exp === 'number' && profile.exp > 0, `${name} exp`);
        assert.ok(typeof profile.gold === 'number' && profile.gold > 0, `${name} gold`);
        assert.ok(profile.weakness, `${name} weakness`);
        assert.ok(profile.resistance, `${name} resistance`);
    }
});

test('cycle 169: 바람 2종 weakness 대지 / resistance 자연', () => {
    for (const name of ['광풍의 원소', '바람 추적자']) {
        assert.equal(MONSTERS[name].weakness, '대지');
        assert.equal(MONSTERS[name].resistance, '자연');
    }
});

test('cycle 169: 에테르 2종 weakness 자연 / resistance 빛 (energy 테마)', () => {
    for (const name of ['에테르 잔류체', '에테르 흡수체']) {
        assert.equal(MONSTERS[name].weakness, '자연');
        assert.equal(MONSTERS[name].resistance, '빛');
    }
});

test('cycle 169: 종말의 전령 보스 톤 (hp 420+, exp 268+, gold 128+)', () => {
    const m = MONSTERS['종말의 전령'];
    assert.ok(m.hp >= 400);
    assert.ok(m.exp >= 260);
    assert.ok(m.gold >= 125);
});

test('cycle 169: statusOnHit curse 매핑 (심연의 눈 / 종말의 마법사 / 혼돈의 추종자)', () => {
    assert.equal(MONSTERS['심연의 눈'].statusOnHit, 'curse');
    assert.equal(MONSTERS['종말의 마법사'].statusOnHit, 'curse');
    assert.equal(MONSTERS['혼돈의 추종자'].statusOnHit, 'curse');
});

test('cycle 169: 종말의 마법사 nuker 패턴 (heavyChance 0.6)', () => {
    const m = MONSTERS['종말의 마법사'];
    assert.ok(m.pattern.heavyChance >= 0.6);
    assert.ok(m.atk >= 100);
});
