import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 167: maps.ts 참조 누락 monster profile 추가 — 자연/공허/동굴 8종 batch
 * (cycle 165 baseline 26 → 18).
 *
 * cycle 165 화염/얼음, cycle 166 언데드/폭풍에 이은 세 번째 batch.
 *
 * 자연/꽃 (4종) — weakness 화염, resistance 자연:
 * - 봄의 정령, 정원 요정 (statusOnHit poison), 꽃 골렘 (탱커), 꽃잎 슬라임 (statusOnHit poison)
 *
 * 공허 (3종) — weakness 빛, resistance 어둠:
 * - 공허 감시병 (탱커), 공허 마법사 (statusOnHit curse), 공허의 파편
 *
 * 동굴 (1종) — weakness 빛, resistance 어둠:
 * - 동굴 박쥐 (저레벨 quick striker)
 */

const NATURE = ['봄의 정령', '정원 요정', '꽃 골렘', '꽃잎 슬라임'];
const VOID = ['공허 감시병', '공허 마법사', '공허의 파편'];
const CAVE = ['동굴 박쥐'];

test('cycle 167: 자연/꽃 4종 모두 MONSTERS 등록 + weakness 화염 / resistance 자연', () => {
    for (const name of NATURE) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.weakness, '화염');
        assert.equal(profile.resistance, '자연');
    }
});

test('cycle 167: 공허 3종 모두 MONSTERS 등록 + weakness 빛 / resistance 어둠', () => {
    for (const name of VOID) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.weakness, '빛');
        assert.equal(profile.resistance, '어둠');
    }
});

test('cycle 167: 동굴 박쥐 등록 + 저레벨 quick striker stats', () => {
    const bat = MONSTERS['동굴 박쥐'];
    assert.ok(bat);
    assert.equal(bat.weakness, '빛');
    assert.equal(bat.resistance, '어둠');
    assert.ok(bat.hp <= 200, '저레벨 박쥐는 hp 낮음');
    assert.ok(bat.pattern.heavyChance >= 0.3, 'quick striker pattern');
});

test('cycle 167: statusOnHit 매핑 — poison 2종 (정원 요정/꽃잎 슬라임) + curse 1종 (공허 마법사)', () => {
    assert.equal(MONSTERS['정원 요정'].statusOnHit, 'poison');
    assert.equal(MONSTERS['꽃잎 슬라임'].statusOnHit, 'poison');
    assert.equal(MONSTERS['공허 마법사'].statusOnHit, 'curse');
});

test('cycle 167: 꽃 골렘 탱커 패턴 (높은 guardChance, 낮은 heavyChance)', () => {
    const golem = MONSTERS['꽃 골렘'];
    assert.ok(golem.pattern.guardChance >= 0.25);
    assert.ok(golem.pattern.heavyChance <= 0.25);
    assert.ok(golem.def >= 30);
});
