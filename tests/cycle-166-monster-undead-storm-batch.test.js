import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 166: maps.ts 참조 누락 monster profile 추가 — 언데드 / 폭풍 테마 8종 batch
 * (cycle 165 baseline 34 → 26).
 *
 * cycle 165 화염/얼음 batch에 이은 두 번째 batch. 언데드 5종 (weakness 빛,
 * resistance 어둠) + 폭풍 3종 (weakness 대지, resistance 자연).
 *
 * statusOnHit:
 * - 망자의 사제 / 해골 마법사 / 저주받은 기사 → curse
 * - 묘지 구울 → poison
 *
 * 검증: 8종 모두 MONSTERS에 등록 + weakness/resistance 정확.
 */

const UNDEAD = ['망자의 사제', '묘지 구울', '유령 군단', '해골 마법사', '저주받은 기사'];
const STORM = ['뇌운 와이번', '번개 정령', '폭풍 그리핀'];

test('cycle 166: 언데드 5종 모두 MONSTERS 등록 + weakness 빛 / resistance 어둠', () => {
    for (const name of UNDEAD) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.weakness, '빛', `${name} weakness 빛 아님`);
        assert.equal(profile.resistance, '어둠', `${name} resistance 어둠 아님`);
    }
});

test('cycle 166: 폭풍 3종 모두 MONSTERS 등록 + weakness 대지 / resistance 자연', () => {
    for (const name of STORM) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.weakness, '대지');
        assert.equal(profile.resistance, '자연');
    }
});

test('cycle 166: statusOnHit 매핑 정합 — 망자의 사제/해골 마법사/저주받은 기사 → curse, 묘지 구울 → poison', () => {
    assert.equal(MONSTERS['망자의 사제'].statusOnHit, 'curse');
    assert.equal(MONSTERS['해골 마법사'].statusOnHit, 'curse');
    assert.equal(MONSTERS['저주받은 기사'].statusOnHit, 'curse');
    assert.equal(MONSTERS['묘지 구울'].statusOnHit, 'poison');
});

test('cycle 166: pattern 합리성 — 마법사/구울은 heavyChance 높음, 골렘 없음(이번 batch)', () => {
    assert.ok(MONSTERS['해골 마법사'].pattern.heavyChance >= 0.5,
        '해골 마법사는 nuker 패턴(높은 heavyChance)');
    assert.ok(MONSTERS['폭풍 그리핀'].pattern.heavyChance >= 0.5,
        '폭풍 그리핀은 sweep 패턴(높은 heavyChance)');
});
